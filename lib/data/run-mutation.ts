import type { Result } from "@/lib/data/result";
import type { ToastApi } from "@/components/ui/use-toast";

// Centralized mutation pattern shared by every entity hook (frontend-ux-improvements
// design §3, Requirements 6.1, 6.2, 6.3, 3.2). Extracted as a pure helper so the
// mutation-atomicity property (Property 6) and errors-not-silent property (Property 2)
// can be tested without rendering React.
//
//   on ok    => apply the local-state change exactly once, then show one success toast
//   on error => show exactly one error toast and leave local state untouched

export interface RunMutationArgs<T> {
  /** The repository call that performs the mutation. */
  op: () => Promise<Result<T>>;
  toast: ToastApi;
  successMessage: string;
  /** Applied to local state exactly once on success. Receives the returned row. */
  apply?: (data: T) => void;
  /** Optional transform for the displayed error message. */
  errorMessage?: (error: string) => string;
}

export async function runMutation<T>(args: RunMutationArgs<T>): Promise<Result<T>> {
  const result = await args.op();
  if (result.ok) {
    args.apply?.(result.data);
    args.toast.success(args.successMessage);
  } else {
    args.toast.error(
      args.errorMessage ? args.errorMessage(result.error) : result.error
    );
  }
  return result;
}
