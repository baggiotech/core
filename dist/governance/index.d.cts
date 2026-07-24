export { P as PLAN_QUOTAS, a as PlanQuotas, c as can, g as getPlanQuotas, i as isPlanAtLeast } from '../gating-Da8GdeOv.cjs';
import '../index-CdIZiX7c.cjs';

interface ImpersonationAware {
    isImpersonating: boolean;
}
declare function isActionAllowedUnderImpersonation(action: string): boolean;
declare function assertImpersonationSafe(session: ImpersonationAware, action: string): void;

export { type ImpersonationAware, assertImpersonationSafe, isActionAllowedUnderImpersonation };
