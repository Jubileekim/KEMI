import { z } from "zod";
import {
  signupRequestSchema,
  userRoleSchema,
  userStatusSchema,
} from "@kemi/shared";

// P01 form contract. Intentionally separate from the incompatible API password schema.
export const signupFormSchema = signupRequestSchema
  .extend({
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상 입력해 주세요.")
      .max(64, "비밀번호는 64자 이하로 입력해 주세요.")
      .regex(
        /^(?=.*[A-Za-z])(?=.*[0-9]).*$/,
        "영문과 숫자를 함께 입력해 주세요.",
      ),
    passwordConfirm: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "비밀번호가 일치하지 않아요.",
  });

export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.email().nullable(),
  name: z.string(),
  role: userRoleSchema,
  status: userStatusSchema,
});
export const authResponseSchema = z.object({
  accessToken: z.string().min(1),
  accessTokenExpiresIn: z.number().positive().finite(),
  user: authUserSchema,
});
