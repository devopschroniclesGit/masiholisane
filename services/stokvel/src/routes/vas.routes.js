const express = require('express');
const router  = express.Router();
const prisma  = require('../../../../shared/config/database');
const { authenticate } = require('../../../../shared/middleware/auth');
const { sendSuccess, sendError } = require('../../../../shared/utils/response');

const NETWORKS = {
  airtime: ['Vodacom', 'MTN', 'Cell C', 'Telkom'],
  data:    ['Vodacom', 'MTN', 'Cell C', 'Telkom'],
};

// Defaults used only if no VasFeeConfig row exists yet for a product type
// (e.g. right after the migration, before an admin has set anything).
// Electricity defaults to 0% — token prices are regulated (NRS 057), most
// resellers can't add a margin directly on top of the tariff. Leave it at
// 0 unless you've confirmed a markup is actually allowed for your setup.
const DEFAULT_FEE_PERCENT = { airtime: 3, data: 3, electricity: 0 };

async function getFeePercent(productType) {
  const config = await prisma.vasFeeConfig.findUnique({ where: { productType } });
  return config ? config.feePercent : (DEFAULT_FEE_PERCENT[productType] ?? 0);
}

// GET /vas/products — list available products
router.get('/products', authenticate, async (req, res, next) => {
  try {
    const [airtimeFee, dataFee, electricityFee] = await Promise.all([
      getFeePercent('airtime'),
      getFeePercent('data'),
      getFeePercent('electricity'),
    ]);

    return sendSuccess(res, {
      airtime: {
        networks: NETWORKS.airtime,
        amounts:  [1000, 2000, 5000, 10000, 20000, 5000000], // R10-R500 in cents
        feePercent: airtimeFee,
      },
      data: {
        networks: NETWORKS.data,
        bundles: [
          { id: 'data_50mb',  label: '50 MB',  price: 1000, validity: '1 day' },
          { id: 'data_500mb', label: '500 MB', price: 5000, validity: '7 days' },
          { id: 'data_1gb',   label: '1 GB',   price: 8500, validity: '30 days' },
          { id: 'data_2gb',   label: '2 GB',   price: 15000, validity: '30 days' },
          { id: 'data_5gb',   label: '5 GB',   price: 30000, validity: '30 days' },
        ],
        feePercent: dataFee,
      },
      electricity: {
        providers: ['Eskom', 'City of Cape Town', 'City of Johannesburg', 'eThekwini'],
        minAmount: 5000,    // R50
        maxAmount: 500000,  // R5,000
        feePercent: electricityFee,
      },
    });
  } catch (err) { next(err); }
});

// POST /vas/purchase — buy a VAS product
router.post('/purchase', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, network, amount, phoneNumber, meterNumber, provider, bundleId } = req.body;

    if (!type) return sendError(res, 400, 'Product type required');
    if (!amount || amount <= 0) return sendError(res, 400, 'Amount required');

    // Validate phone for airtime/data
    if (['airtime', 'data'].includes(type)) {
      if (!phoneNumber || !/^0\d{9}$/.test(phoneNumber)) {
        return sendError(res, 400, 'Valid SA phone number required (e.g. 0821234567)');
      }
      if (!network) return sendError(res, 400, 'Network required');
    }

    // Validate meter for electricity
    if (type === 'electricity') {
      if (!meterNumber || meterNumber.length < 8) {
        return sendError(res, 400, 'Valid meter number required');
      }
      if (!provider) return sendError(res, 400, 'Provider required');
    }

    const account = await prisma.account.findUnique({ where: { userId } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    // amount is the face value the member receives (e.g. R50 airtime).
    // The fee is added on top — the member pays face value + fee, we keep the fee.
    const feePercent = await getFeePercent(type);
    const feeAmount  = Math.round(amount * feePercent / 100);
    const totalCharge = amount + feeAmount;

    // Check for duplicate purchase within last 60 seconds
    const sixtySecondsAgo = new Date(Date.now() - 60 * 1000);
    const duplicate = await prisma.transaction.findFirst({
      where: {
        fromAccountId: account.id,
        type:          'vas',
        amount:        totalCharge,
        createdAt:     { gte: sixtySecondsAgo },
        description:   { contains: phoneNumber || meterNumber || '' },
      },
    });
    if (duplicate && !req.body.confirmDuplicate) {
      return sendError(res, 409,
        `You made an identical purchase ${Math.round((Date.now() - new Date(duplicate.createdAt).getTime()) / 1000)} seconds ago. Confirm if you really want to buy again.`,
        { duplicate: true, lastPurchaseAt: duplicate.createdAt }
      );
    }

    const totalBalance = account.balance + (account.bonusBalance || 0);
    if (totalBalance < totalCharge) {
      return sendError(res, 400,
        `Insufficient balance. Have R${(totalBalance / 100).toFixed(2)}, need R${(totalCharge / 100).toFixed(2)} (R${(amount / 100).toFixed(2)} + R${(feeAmount / 100).toFixed(2)} fee)`
      );
    }

    // Spend bonus first, then cash
    const fromBonus = Math.min(totalCharge, account.bonusBalance || 0);
    const fromCash  = totalCharge - fromBonus;

    const { saveAs, recipientId } = req.body;

    await prisma.$transaction(async (tx) => {
      await tx.account.update({
        where: { userId },
        data:  {
          bonusBalance: { decrement: fromBonus },
          balance:      { decrement: fromCash },
        },
      });

      // Single transaction record for the purchase — amount is the TOTAL
      // charged (face value + fee), consistent with every other transaction
      // in the app representing real money movement.
      const desc = type === 'airtime' ? `Airtime, ${network} ${phoneNumber}`
                 : type === 'data'    ? `Data, ${network} ${phoneNumber}`
                 :                       `Electricity, ${provider} ${meterNumber}`;

      await tx.transaction.create({
        data: {
          fromAccountId:  account.id,
          amount:         totalCharge,
          type:           'vas',
          status:         'completed',
          idempotencyKey: `vas-${type}-${userId}-${Date.now()}`,
          description:    desc + (feeAmount > 0 ? ` (R${(amount/100).toFixed(2)} + R${(feeAmount/100).toFixed(2)} fee)` : '')
                                + (fromBonus > 0 ? ` (R${(fromBonus/100).toFixed(2)} from bonus)` : ''),
        },
      });
    });

    // Save recipient if requested
    if (saveAs && !recipientId) {
      try {
        await prisma.savedRecipient.create({
          data: {
            userId: req.user.id,
            type:   ['airtime', 'data'].includes(type) ? 'airtime_data' : 'electricity',
            label:  saveAs,
            network, phoneNumber, meterNumber, provider,
            lastUsedAt: new Date(),
          },
        });
      } catch (e) { /* ignore */ }
    } else if (recipientId) {
      try {
        await prisma.savedRecipient.update({
          where: { id: recipientId },
          data:  { lastUsedAt: new Date() },
        });
      } catch (e) { /* ignore */ }
    }

    // ── STUB: In production, this is where we call Flash API ──
    // const flashResult = await flash.purchase({ type, network, amount, phoneNumber });

    const voucher = type === 'electricity'
      ? Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString().match(/.{1,4}/g).join('-')
      : null;

    return sendSuccess(res, {
      type,
      amount,
      formatted:     `R${(amount / 100).toFixed(2)}`,
      feePercent,
      feeAmount,
      feeFormatted:  `R${(feeAmount / 100).toFixed(2)}`,
      totalCharge,
      totalFormatted: `R${(totalCharge / 100).toFixed(2)}`,
      paidFromBonus: fromBonus,
      paidFromCash:  fromCash,
      ...(voucher && { voucher }),
      ...(phoneNumber && { phoneNumber }),
    }, type === 'electricity'
      ? `Electricity voucher generated. Token: ${voucher}`
      : `${type === 'airtime' ? 'Airtime' : 'Data'} sent to ${phoneNumber}`);
  } catch (err) { next(err); }
});

// GET /vas/recipients — list saved recipients
router.get('/recipients', authenticate, async (req, res, next) => {
  try {
    const recipients = await prisma.savedRecipient.findMany({
      where:   { userId: req.user.id },
      orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    });
    return sendSuccess(res, { recipients });
  } catch (err) { next(err); }
});

// POST /vas/recipients — save a recipient
router.post('/recipients', authenticate, async (req, res, next) => {
  try {
    const { type, label, network, phoneNumber, meterNumber, provider } = req.body;
    if (!type || !label) return sendError(res, 400, 'Type and label required');

    const recipient = await prisma.savedRecipient.create({
      data: {
        userId: req.user.id,
        type, label, network, phoneNumber, meterNumber, provider,
      },
    });
    return sendSuccess(res, { recipient }, 'Recipient saved');
  } catch (err) { next(err); }
});

// DELETE /vas/recipients/:id
router.delete('/recipients/:id', authenticate, async (req, res, next) => {
  try {
    const r = await prisma.savedRecipient.findUnique({ where: { id: req.params.id } });
    if (!r || r.userId !== req.user.id) return sendError(res, 404, 'Not found');
    await prisma.savedRecipient.delete({ where: { id: req.params.id } });
    return sendSuccess(res, {}, 'Recipient removed');
  } catch (err) { next(err); }
});

// GET /vas/history — recent VAS purchases
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const account = await prisma.account.findUnique({ where: { userId: req.user.id } });
    if (!account) return sendError(res, 404, 'Wallet not found');

    const transactions = await prisma.transaction.findMany({
      where: {
        fromAccountId: account.id,
        type:          'vas',
      },
      orderBy: { createdAt: 'desc' },
      take:    20,
    });
    return sendSuccess(res, { transactions });
  } catch (err) { next(err); }
});

module.exports = router;
