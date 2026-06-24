// shared/utils/money.js
// ALL financial calculations go through here
// NEVER use floating point for money — always integers in cents

const TIER_AMOUNTS = {
  1: 50000,   // R500   in cents
  2: 100000,  // R1,000 in cents
  3: 200000,  // R2,000 in cents
};

// Security deposit = full contribution amount
// Must cover one full dropout pot share
const SECURITY_DEPOSITS = {
  1: 50000,   // R500  — covers full dropout (R490 pot share + buffer)
  2: 100000,  // R1,000
  3: 200000,  // R2,000
};

const PLATFORM_FEE_PERCENT = 2;   // 2%  → platform revenue
const TO_POT_PERCENT       = 98;  // 98% → recipient pot
const LOYALTY_BONUS        = 5000; // R50 in cents — position 3 bonus

function splitContribution(amount) {
  const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT / 100);
  const toPot       = amount - platformFee;
  return { platformFee, toPot };
}

function calculatePot(tier) {
  const contribution = TIER_AMOUNTS[tier];
  const { toPot }    = splitContribution(contribution);
  return toPot * 3;
}

function calculateMemberSummary(tier) {
  const contribution     = TIER_AMOUNTS[tier];
  const deposit          = SECURITY_DEPOSITS[tier];
  const { platformFee, toPot } = splitContribution(contribution);
  const pot              = toPot * 3;
  const totalContributed = contribution * 3;
  const platformFeeTotal = platformFee * 3;

  return {
    monthlyContribution: contribution,
    securityDeposit:     deposit,
    platformFeeMonthly:  platformFee,
    platformFeeTotal,
    toPotMonthly:        toPot,
    potReceived:         pot,
    totalContributed,
    netCost:             totalContributed - pot,
    firstMonthTotal:     contribution + deposit,
    subsequentMonths:    contribution,
  };
}

function formatRands(cents) {
  return `R${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function randsToCents(rands) {
  return Math.round(rands * 100);
}

function getTierAmount(tier) {
  if (!TIER_AMOUNTS[tier]) throw new Error(`Invalid tier: ${tier}`);
  return TIER_AMOUNTS[tier];
}

function getSecurityDeposit(tier) {
  if (!SECURITY_DEPOSITS[tier]) throw new Error(`Invalid tier: ${tier}`);
  return SECURITY_DEPOSITS[tier];
}

function getMinimumJoinBalance(tier, requiresDeposit = true) {
  const contribution = getTierAmount(tier);
  const deposit      = requiresDeposit ? getSecurityDeposit(tier) : 0;
  return contribution + deposit;
}

module.exports = {
  TIER_AMOUNTS,
  SECURITY_DEPOSITS,
  PLATFORM_FEE_PERCENT,
  TO_POT_PERCENT,
  LOYALTY_BONUS,
  splitContribution,
  calculatePot,
  calculateMemberSummary,
  formatRands,
  randsToCents,
  getTierAmount,
  getSecurityDeposit,
  getMinimumJoinBalance,
};
