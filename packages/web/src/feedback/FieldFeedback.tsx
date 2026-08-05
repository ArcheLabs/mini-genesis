import type { NormalizedFeedback } from "./types";
export function FieldFeedback({ feedback }: { feedback: NormalizedFeedback | null }) { if (!feedback) return null; return <p className="field-feedback" role="alert"><strong>{feedback.title}</strong><span>{feedback.message}</span></p>; }
