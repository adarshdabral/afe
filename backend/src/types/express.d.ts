import type { Role, RegistrationStatus } from "../shared/access";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: Role;
        registrationStatus?: RegistrationStatus;
      };
    }
  }
}

export {};
