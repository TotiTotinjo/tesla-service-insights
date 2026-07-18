/**
 * Service Bulletin votes only unlock once an issue is widespread.
 * "More than 1,000 people have the issue" → ownerCount > 1000.
 */
export const BULLETIN_VOTE_MIN_OWNERS = 1000;

export function canVoteForBulletin(ownerCount: number): boolean {
  return ownerCount > BULLETIN_VOTE_MIN_OWNERS;
}

export function bulletinUnlockMessage(ownerCount: number): string {
  const need = BULLETIN_VOTE_MIN_OWNERS + 1;
  const left = Math.max(0, need - ownerCount);
  if (left === 0) {
    return "Eligible for Service Bulletin votes.";
  }
  return `Service Bulletin voting unlocks after more than ${BULLETIN_VOTE_MIN_OWNERS.toLocaleString()} owners report this (${ownerCount.toLocaleString()} so far · ${left.toLocaleString()} more needed).`;
}
