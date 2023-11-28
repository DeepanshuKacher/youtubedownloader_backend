import { IsBoolean, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class UrlValidation {
  @IsUrl()
  videoUrl: string;
}

export class DownloadVideo {
  @IsUrl()
  videoUrl: string;

  @IsInt()
  itag: number;

  @IsBoolean()
  @IsOptional()
  hasAudio?: boolean;

  @IsString()
  @IsOptional()
  fileName?: string;
}
