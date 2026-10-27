import { z } from "zod";
import {
  signupRequestSchema,
  userRoleSchema,
  userStatusSchema,
} from "@kemi/shared";

// P01 가입 규칙(8~64자, 영문+숫자). API 규칙(8자 이상, 72바이트 이하)보다 엄격하게 두어,
// 이 폼을 통과한 비밀번호는 항상 서버도 받는다(바이트 상한을 함께 검사한다).
export const signupFormSchema = signupRequestSchema
  .extend({
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상 입력해 주세요.")
      .max(64, "비밀번호는 64자 이하로 입력해 주세요.")
      .regex(
        /^(?=.*[A-Za-z])(?=.*[0-9]).*$/,
        "영문과 숫자를 함께 입력해 주세요.",
      )
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        "비밀번호가 너무 길어요. 한글·특수문자를 줄여 주세요.",
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
