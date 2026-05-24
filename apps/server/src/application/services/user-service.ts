import { createUserService } from "@solid-imager/application/services/user-service";
import { UserRepository } from "~/infrastructure/repositories/user-repository";

export const UserService = createUserService(UserRepository);
