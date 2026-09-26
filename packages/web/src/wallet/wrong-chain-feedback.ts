export function syncWrongChainFeedback(input: {
  correctChain: boolean;
  clear: () => void;
  present: () => void;
}): void {
  if (input.correctChain) input.clear();
  else input.present();
}
