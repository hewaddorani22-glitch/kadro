/** A cold deep link must never turn the initial demo values into a saved meal. */
export function requiresMealDraftRedirect(route: string, analysisStatus: string): boolean {
  return (route === 'confirm' || route === 'result') && analysisStatus !== 'ready';
}
