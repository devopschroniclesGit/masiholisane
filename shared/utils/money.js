// All amounts in cents
const TIER_AMOUNTS = {
  1: 50000,    // R500
  2: 100000,   // R1,000
  3: 200000,   // R2,000
};

const SECURITY_DEPOSITS = {
  1: 0, 2: 0, 3: 0,
};

const WITHDRAWAL_FEE_PERCENT = 0.02; // 2% on bank withdrawals
const GROUP_SIZE = 3;

// No fee deducted on contribution — full amount goes to pot
function splitContribution(contributionAmount) {
  return {
    platformFee: 0,
    toPot:       contributionAmount,
  };
}

// Pot = contribution × (members - 1)
// Full amount, no fee deduction
function calculatePot(tier) {
  const contribution = getTierAmount(tier);
  return contribution * (GROUP_SIZE - 1);
}

// Calculate withdrawal fee at bank withdrawal time
function calculateWithdrawalFee(amount) {
  return Math.floor(amount * WITHDRAWAL_FEE_PERCENT);
}

function calculateMemberSummary(tier) {
  const contribution = getTierAmount(tier);
  const pot          = calculatePot(tier);
  const totalPaid    = contribution * (GROUP_SIZE - 1);
  const withdrawalFee = calculateWithdrawalFee(pot);
  return {
    contributionPerCycle: contribution,
    cyclesContributing:   GROUP_SIZE - 1,
    totalPaid,
    payoutReceived:       pot,
    withdrawalFee,
    netIfWithdrawn:       pot - withdrawalFee,
    netCost:              totalPaid - pot,
  };
}

function formatRands(cents) {
  return `R${(cents / 100).toFixed(2)}`;
}

function randsToCents(rands) {
  return Math.round(rands * 100);
}

function getTierAmount(tier) {
  return TIER_AMOUNTS[tier];
}

function getSecurityDeposit(tier) {
  return SECURITY_DEPOSITS[tier];
}

function getMinimumJoinBalance(tier) {
  return getTierAmount(tier);
}

module.exports = {
  TIER_AMOUNTS,
  SECURITY_DEPOSITS,
  WITHDRAWAL_FEE_PERCENT,
  GROUP_SIZE,
  splitContribution,
  calculatePot,
  calculateWithdrawalFee,
  calculateMemberSummary,
  formatRands,
  randsToCents,
  getTierAmount,
  getSecurityDeposit,
  getMinimumJoinBalance,
};
