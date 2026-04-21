export const AFFILIATE_PRO_PAYOUT_EUR = 2;
export const AFFILIATE_PRO_REFERENCE_PRICE_EUR = 3;
export const AFFILIATE_CONTRACT_TERM_OPTIONS = Object.freeze([2, 3, 6, 12]);

export function isSupportedAffiliateTerm(termMonths) {
  return AFFILIATE_CONTRACT_TERM_OPTIONS.includes(Number(termMonths));
}

export function getAffiliateRuleLabel() {
  return `${AFFILIATE_PRO_PAYOUT_EUR}EUR / Pro actif`;
}

