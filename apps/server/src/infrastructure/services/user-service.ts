import { createUserService } from "@solid-imager/application/users";
import { UserRepository } from "~/infrastructure/db/repositories";

export const UserService = createUserService(UserRepository);
