import {
  Body,
  Controller,
  Get,
  ParseBoolPipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';

import { AppService } from './app.service';
import { UrlValidation } from './dto/validation.dto';
import { Response } from 'express';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('videourl')
  async queryfull(
    @Query('url') videoUrl: string,
    @Query('itag', ParseIntPipe) itag: number,
  ) {
    return { videoUrl, itag };
  }
  @Get('video')
  async query(
    @Query('url') videoUrl: string,
    @Query('itag', ParseIntPipe)
    itag: number,
    @Query('title') title: string,
    @Query('audio', ParseBoolPipe) hasAudio: boolean,
    @Res() res: Response,
  ) {
    const { fileLocation } = await this.appService.getHD({
      itag,
      videoUrl,
      fileName: `${title}.mp4`,
      hasAudio,
    });
    res.download(fileLocation, `${title}.mp4`);
  }

  @Post()
  getAvailableQualities(@Body() dto: UrlValidation) {
    return this.appService.sendAvailableQualities(dto);
  }

  @Get('quality')
  sendVideoQuality(@Query() dto: UrlValidation) {
    return this.appService.sendAvailableQualities1(dto);
  }
  @Get('download')
  sendVideoQuality22(@Query() dto: UrlValidation) {
    return this.appService.downloadVideo111(dto);
  }

  @Post('check')
  temp() {
    return 'Hello Anku';
  }
}
