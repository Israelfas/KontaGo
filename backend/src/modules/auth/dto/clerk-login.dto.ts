import { IsString, MinLength } from 'class-validator';

export class ClerkLoginDto {
  @IsString()
  @MinLength(1)
  clerkToken: string;
}
