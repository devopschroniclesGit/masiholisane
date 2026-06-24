// shared/utils/money.js
// ALL financial calculations go through here
// NEVER use floating point for money — always integers in cents

const TIER_AMOUNTS = {
  1: 50000,   // R500   in cents
  2: 100000,  // R1,000 in cents
  3: 200000,  // R2,000 in cents
};

const SECURITY_DEPOSITS = {
  1: 10000,   // R100 in cents
  2: 20000,   // R200 in cents
  3: 40000,   // R400 in cents
};

const PLATFORM_FEE_PERCENT = 2;   // 2%
const BACKUP_FUND_PERCENT  = 5;   // 5%
const TO_POT_PERCENT       = 93;  // 93%
const LOYALTY_BONUS        = 5000; // R50 in cents — for position 3

/**
 * Split a contribution into its components
 * @param {number} amount - contribution in cents
 * @returns {{ platformFee, backupFund, toPot }}
 */
function splitContribution(amount) {
  const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT / 100);
  const backupFund  = Math.floor(amount * BACKUP_FUND_PERCENT  / 100);
  const toPot       = amount - platformFee - backupFund;

  return { platformFee, backupFund, toPot };
}

/**
 * Calculate total pot for a group (what recipient receives)
 * @param {number} tier - 1, 2, or 3
 * @returns {number} pot amount in cents
 */
function calculatePot(tier) {
  const contribution = TIER_AMOUNTS[tier];
  const { toPot } = splitContribution(contribution);
  return toPot * 3; // 3 members
}

/**
 * Format cents to Rands string for display
 * @param {number} cents
 * @returns {string} e.g. "R1,395.00"
 */
function formatRands(cents) {
  return `R${(cents / 100).toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Convert Rands to cents (for user input)
 * @param {number} rands
 * @returns {number} cents
 */
function randsToCents(rands) {
  return Math.round(rands * 100);
}

/**
 * Get contribution amount for a tier
 */
function getTierAmount(tier) {
  if (!TIER_AMOUNTS[tier]) throw new Error(`Invalid tier: ${tier}`);
  return TIER_AMOUNTS[tier];
}

/**
 * Get security deposit for a tier
 */
function getSecurityDeposit(tier) {
  if (!SECURITY_DEPOSITS[tier]) throw new Error(`Invalid tier: ${tier}`);
  return SECURITY_DEPOSITS[tier];
}

/**
 * Minimum wallet balance required to join a group
 * (first contribution + security deposit)
 */
function getMinimumJoinBalance(tier, requiresDeposit = true) {
  const contribution = getTierAmount(tier);
  const deposit = requiresDeposit ? getSecurityDeposit(tier) : 0;
  return contribution + deposit;
}

module.exports = {
  TIER_AMOUNTS,
  SECURITY_DEPOSITS,
  PLATFORM_FEE_PERCENT,
  BACKUP_FUND_PERCENT,
  LOYALTY_BONUS,
  splitContribution,
  calculatePot,
  formatRands,
  randsToCents,
  getTierAmount,
  getSecurityDeposit,
  getMinimumJoinBalance,
};
