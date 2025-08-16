import { UserRole } from 'src/constants/user-role';

export interface IUser {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
    role: UserRole;
    isVerified: boolean;
}
