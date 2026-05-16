import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class AskQuestionDto {
  @IsString()
  @IsNotEmpty()
  question: string;

  @IsString()
  @IsOptional()
  sessionId?: string;
}
