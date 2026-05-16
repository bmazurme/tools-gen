import { IsString, IsNotEmpty } from 'class-validator';

export class CreateChatSessionDto {
  @IsString()
  @IsNotEmpty()
  userId: string;
}
