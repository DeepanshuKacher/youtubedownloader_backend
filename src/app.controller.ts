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

  // @Get()
  // getHello(): any {
  //   return this.appService.getHello();
  // }

  @Get('videourl')
  async queryfull(
    @Query('url') videoUrl: string,
    @Query('itag', ParseIntPipe) itag: number,
    // @Res() res: Response,
  ) {
    return { videoUrl, itag };
    // const filePath = await this.appService.getHD({ itag, videoUrl });
    // res.download(filePath);
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
    // console.log(itag, title, hasAudio, tagi);
    // return { videoUrl, itag };
    const { fileLocation } = await this.appService.getHD({
      itag,
      videoUrl,
      fileName: `${title}.mp4`,
      hasAudio,
    });
    res.download(fileLocation, `${title}.mp4`);
  }

  // @Get(':videourl/:itag')
  // async download(
  //   @Param('videourl') videoUrl: string,
  //   @Param('itag', ParseIntPipe) itag: number,
  //   @Res() res: Response,
  // ) {
  //   const { fileLocation, fileName } = await this.appService.getHD({
  //     itag,
  //     videoUrl,
  //   });
  //   res.download(fileLocation, fileName);
  // }

  @Post()
  getAvailableQualities(@Body() dto: UrlValidation) {
    return this.appService.sendAvailableQualities(dto);
  }

  // @Post('download')
  // async downloadVideo(@Body() dto: DownloadVideo, @Res() res: Response) {
  //   const filePath = await this.appService.getHD(dto);
  //   res.sendFile(filePath, { root: 'downloads' });
  //   // res.download(filePath);
  // }

  @Post('check')
  temp() {
    return 'Hello Anku';
  }
}
