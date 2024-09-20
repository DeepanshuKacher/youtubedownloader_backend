import {
  Injectable,
  InternalServerErrorException,
  // Logger,
} from '@nestjs/common';
import * as ytdl from 'ytdl-core';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { DownloadVideo, UrlValidation } from './dto/validation.dto';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as videoD from '@distube/ytdl-core';

// type VideoMetadata = {
//   mimeType: string;
//   qualityLabel: string;
//   bitrate: number;
//   audioBitrate: number;
//   itag: number;
//   width?: number;
//   height?: number;
//   lastModified: string;
//   quality: string;
//   fps?: number;
//   projectionType: string;
//   audioQuality?: string;
//   approxDurationMs: string;
//   audioSampleRate?: string;
//   audioChannels?: number;
//   url: string;
//   hasVideo: boolean;
//   hasAudio: boolean;
//   container: string;
//   codecs: string;
//   videoCodec: string;
//   audioCodec: string;
//   isLive: boolean;
//   isHLS: boolean;
//   isDashMPD: boolean;
// };

@Injectable()
export class AppService {
  constructor(
    // private downloadFolder: './downloads',
    private config: ConfigService,
  ) {
    this.createDownloadsDirectory();
  }

  downloadFolder: './downloads';

  async getHello(): Promise<any> {
    return 'hello';
    const videoURL = 'https://youtu.be/8ZQJDnWv9hw';
    const output = './videos/video.mp4';

    try {
      // const temp = await ytdl.getInfo(videoURL);

      // return temp.formats.map((item) => {
      //   const u
      //     container,
      //     hasAudio,
      //     quality,
      //     audioBitrate,
      //     codecs,
      //     audioQuality,
      //     qualityLabel,
      //     bitrate,
      //   } = item;
      //   return `hasVideo: ${item.hasVideo}, audioQuality: ${audioQuality}, itag: ${item.itag}, container: ${item.container}, quality: ${item.quality}, audioBitrate: ${item.audioBitrate}, hasAudio: ${item.hasAudio}`;

      //   // return { container, hasAudio, quality, audioBitrate };
      // });
      return new Promise((resolve, reject) => {
        ytdl(videoURL, {
          filter: (format) =>
            format.quality === 'hd1080' && format.container === 'mp4',
        })
          .pipe(fs.createWriteStream(output))
          .on('finish', () => {
            resolve('Video downloaded successfully!');
          })
          .on('error', (err) => {
            reject(err);
          });
      });
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(error);
    }
  }

  downloadVideo({
    itag,
    videolink,
    outputLocation,
  }: {
    videolink: string;
    itag: number;
    outputLocation: string;
  }) {
    return new Promise((resolve, reject) => {
      ytdl(videolink, {
        filter: (format) => format.itag === itag,
      })
        .pipe(fs.createWriteStream(outputLocation))
        .on('finish', () => {
          resolve(true);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  downloadAudio({
    outputLocation,
    url,
  }: {
    url: string;
    outputLocation: string;
  }) {
    return new Promise((resolve, reject) => {
      ytdl(url, {
        filter: (format) =>
          format.container === 'mp4' &&
          !format.hasVideo &&
          format.audioQuality === 'AUDIO_QUALITY_MEDIUM',
      })
        .pipe(fs.createWriteStream(outputLocation))
        .on('finish', () => {
          resolve(true);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  getName(nameFor: 'video' | 'audio' | 'merge') {
    const randString = randomUUID().slice(0, 5);
    const currentTime = Date.now();

    switch (nameFor) {
      case 'audio':
        return currentTime + '#' + randString + '_audio' + '.mp3';
      case 'merge':
        return currentTime + '#' + randString + '_merge' + '.mp4';
      case 'video':
        return currentTime + '#' + randString + '_merge' + '.mp4';
    }
  }

  getlocation(name: string) {
    return `./downloads/${name}`;
  }

  mergeAudioVideo({
    audioLocation,
    mergeOutputLocation,
    videoLocation,
  }: {
    audioLocation: string;
    videoLocation: string;
    mergeOutputLocation: string;
  }) {
    return new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i',
        videoLocation,
        '-i',
        audioLocation,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-strict',
        'experimental',
        mergeOutputLocation,
      ]);

      // ffmpegProcess.stdout.on('data', (data) => {
      //   console.log('ffmpeg: ' + data);
      // });

      // ffmpegProcess.stderr.on('data', (data) => {
      //   console.error('ffmpeg error: ' + data);
      // });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve(true);
          // console.log('Audio and video merged successfully!');
          // Optionally, you can delete the separate video and audio files here if needed.
        } else {
          // console.error('ffmpeg process exited with code ' + code);
          reject(code);
        }
      });
    });
  }

  async getHD(dto: DownloadVideo): Promise<{ fileLocation: string }> {
    const { hasAudio, itag, videoUrl } = dto;

    const mergedOutput = this.getlocation(this.getName('merge')); // Merged file path
    const videoOutput = this.getlocation(this.getName('video')); // Video file path
    const audioOutput = this.getlocation(this.getName('audio')); // Audio file path
    console.log('211');
    try {
      if (hasAudio === true) {
        await this.downloadVideo({
          outputLocation: mergedOutput,
          itag,
          videolink: videoUrl,
        });
      } else if (hasAudio === false) {
        const downloadVideo = await this.downloadVideo({
          itag,
          outputLocation: videoOutput,
          videolink: videoUrl,
        });

        console.log('226');

        const downloadAudio = await this.downloadAudio({
          outputLocation: audioOutput,
          url: videoUrl,
        });

        // await Promise.all([downloadAudio, downloadVideo]);

        console.log('236');

        await this.mergeAudioVideo({
          audioLocation: audioOutput,
          mergeOutputLocation: mergedOutput,
          videoLocation: videoOutput,
        });
      }

      console.log('246');
      return {
        fileLocation: mergedOutput,
        // fileName,
      };
    } catch (error) {
      if (this.config.get('enviornment') === 'development') console.log(error);
      throw new InternalServerErrorException(error);
    }

    // const randString = randomUUID().slice(0, 5);
    // const currentTime = Date.now();
    // const tempVideoName = currentTime + '#' + randString + '_video',
    // tempAudioName = currentTime + '#' + randString + '_audio',
    // outputUUID = currentTime + '#' + randString + '_merge';
    // const output = './videos/video4.mp4';

    // const ll = randomUUID().slice(0, 5);
    // console.log(Date.now() + '##' + ll);

    // return './downloads/hello.mp4';
    // const video = ytdl(videoURL, {
    //   filter: (format) =>
    //     format.quality === 'hd1080' && format.container === 'mp4',
    // });
    // const audio = ytdl(videoURL, {
    //   filter: (format) => format.container === 'mp4' && !format.hasVideo,
    // });
    // video.pipe(fs.createWriteStream(videoOutput));
    // audio.pipe(fs.createWriteStream(audioOutput));
    // const info = await ytdl.getInfo(videoURL);
    // setTimeout(
    //   () => {
    //     fs.unlink(videoOutput, (err) => {
    //       if (err) throw err;
    //     });
    //     fs.unlink(audioOutput, (err) => {
    //       if (err) throw err;
    //     });
    //     fs.unlink(mergedOutput, (err) => {
    //       if (err) throw err;
    //     });
    //   },
    //   5 * 60 * 1000,
    // );
  }

  async errorLogger(err: any) {
    // enviornment=development #development production

    const enviornment = this.config.get('enviornment');
    if (enviornment === 'development') console.log({ err });

    throw new InternalServerErrorException(err);
  }

  async sendAvailableQualities(dto: UrlValidation) {
    try {
      const { videoUrl } = dto;

      // const temp = {
      //   formats: [
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
      //       qualityLabel: '360p',
      //       bitrate: 557941,
      //       audioBitrate: 96,
      //       itag: 18,
      //       width: 640,
      //       height: 360,
      //       lastModified: '1699318984305620',
      //       contentLength: '6789241',
      //       quality: 'medium',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 557597,
      //       audioQuality: 'AUDIO_QUALITY_LOW',
      //       approxDurationMs: '97407',
      //       audioSampleRate: '44100',
      //       audioChannels: 2,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=18&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=SKzAWU4zU-zfxgthj-CHpOoP&gir=yes&clen=6789241&ratebypass=yes&dur=97.407&lmt=1699318984305620&mt=1700386633&fvip=4&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=UHMuBwH3v8nfwA&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cratebypass%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRgIhALOeYqB6sSYVaSTCFwdengoMFgdNHTeTBusg62MwSus9AiEA2pLyUXJuuLVO_ikNGpee4SmgmHtDEt7Obl74kQA23Ng%3D&sig=ANLwegAwRQIhAOLb9dWFAoQSsuhwiUBP8nGU2twKe_lhyH5mssd92xKcAiBKKH6znmEKTWAmLNM_L4nAu4vUniLzZhDzS017__peEQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: true,
      //       container: 'mp4',
      //       codecs: 'avc1.42001E, mp4a.40.2',
      //       videoCodec: 'avc1.42001E',
      //       audioCodec: 'mp4a.40.2',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.640028"',
      //       qualityLabel: '1080p',
      //       bitrate: 4472188,
      //       audioBitrate: null,
      //       itag: 137,
      //       width: 1920,
      //       height: 1080,
      //       initRange: {
      //         start: '0',
      //         end: '740',
      //       },
      //       indexRange: {
      //         start: '741',
      //         end: '1000',
      //       },
      //       lastModified: '1699319030219194',
      //       contentLength: '43122048',
      //       quality: 'hd1080',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 3543780,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=137&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=43122048&dur=97.347&lmt=1699319030219194&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhANaZ6mj8bPeI28g8MfB849RxdQOMw0X9VshUep9tN5XtAiAE8A_hJsG041nSQJGuQNMJvczqXjKokPnX0-aegM128Q%3D%3D&sig=ANLwegAwRAIgArcBfxThDEHaxwgp-D0XVbInTeh2RpqhRTCxJotZ9OYCIC0kYklxf5OHBoieiMO3NyaCn3EXExZC85pIRSFtynBr',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.640028',
      //       videoCodec: 'avc1.640028',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '1080p',
      //       bitrate: 1730823,
      //       audioBitrate: null,
      //       itag: 248,
      //       width: 1920,
      //       height: 1080,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '535',
      //       },
      //       lastModified: '1699319010793502',
      //       contentLength: '18508719',
      //       quality: 'hd1080',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 1521051,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=248&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=18508719&dur=97.347&lmt=1699319010793502&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAMltLWRNjRx4Vh7PIRihmm2PQG1UbReB93ZSYPlxvzbgAiBDt8spi2nFd8cKuQVfLZ6obCQubc5G6jpPZ55E7ycXpw%3D%3D&sig=ANLwegAwRAIgfPVnoWoD0kja4SWf4f3kZRbHZGVQaFyCvfWsnB99BzMCIE6D0Bpx25PDvEFw1G5A15xwvshguoPEQpdvZdIN5U8t',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.64001f"',
      //       qualityLabel: '720p',
      //       bitrate: 2166645,
      //       audioBitrate: null,
      //       itag: 136,
      //       width: 1280,
      //       height: 720,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319031042322',
      //       contentLength: '22989751',
      //       quality: 'hd720',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 1889303,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=136&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=22989751&dur=97.347&lmt=1699319031042322&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAI9Kus_OHJ4gO5m5xcLg1rHX2KwmqhL6l__LUsX3HYeNAiA5GEz0gScwL23dt68oOtY0gIXOpMO_5k5tAp0vCvb8lg%3D%3D&sig=ANLwegAwRQIhAP5auxqoJ5Ay9q16cwLYsuR6xiakS9rUWVhSqMDH7mN_AiAVvBFNaR9M7bFITX38UgaSyqRZmIOh5n5jgqQxyUaRyQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.64001f',
      //       videoCodec: 'avc1.64001f',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '720p',
      //       bitrate: 1137926,
      //       audioBitrate: null,
      //       itag: 247,
      //       width: 1280,
      //       height: 720,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '533',
      //       },
      //       lastModified: '1699319011059865',
      //       contentLength: '11423973',
      //       quality: 'hd720',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 938824,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=247&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=11423973&dur=97.347&lmt=1699319011059865&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgCeF0LFTH2No3mqvDGOsJD06kmYz4oeDRgcuW_voYjgICIH42iuJPBGsrQr4s4cIgByCY9MKG7LLLn9kAjcHVkBXW&sig=ANLwegAwRQIhANtgFuqE_3xOKQNkY-RyvtzF0ktthL-r6j7pwnCndo5DAiAej1r14JPN50LqvavpgbTl2JJBec0mFWfAJHEvZz_YqQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d401e"',
      //       qualityLabel: '480p',
      //       bitrate: 1131290,
      //       audioBitrate: null,
      //       itag: 135,
      //       width: 854,
      //       height: 480,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319030615375',
      //       contentLength: '11951658',
      //       quality: 'large',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 982190,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=135&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=11951658&dur=97.347&lmt=1699319030615375&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhALVO1pN3XSXYvv2DtZJOPjLYRcbQ7hVdWTBTPCbriOIWAiAeg27Za5iJt1l1Jimj45HzzX9mu4m09be20gwK_OFabA%3D%3D&sig=ANLwegAwRQIgBvdpGCOomm_mHdrvn5EGFtm3ta_T1bWjCfnP53MLkEMCIQDBozkpe80jOxn4ZiHByQUHCMPgvXWZD1KzuDePTodfPA%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d401e',
      //       videoCodec: 'avc1.4d401e',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '480p',
      //       bitrate: 646654,
      //       audioBitrate: null,
      //       itag: 244,
      //       width: 854,
      //       height: 480,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '533',
      //       },
      //       lastModified: '1699319010662731',
      //       contentLength: '6834998',
      //       quality: 'large',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 561701,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=244&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=6834998&dur=97.347&lmt=1699319010662731&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAJH5NwOMmKO1RpRVh6w3JYb43sS41sV0DK3JyaaEkRpvAiBRx5IRYj3Tw_wUZ8W0Q6T9wB7QXkE-qyuQSiOfSwtnXA%3D%3D&sig=ANLwegAwRgIhAKbmKLm0Q2QGjy3CkRi2-f7weLsWx3lJ73SDaspCRnzaAiEAi6-2Lw6tBeCjCXVh_QutTVVJN3jeEPr5S7NklGx46d8%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d401e"',
      //       qualityLabel: '360p',
      //       bitrate: 598150,
      //       audioBitrate: null,
      //       itag: 134,
      //       width: 640,
      //       height: 360,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319030445497',
      //       contentLength: '5652164',
      //       quality: 'medium',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 464496,
      //       highReplication: true,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=134&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=5652164&dur=97.347&lmt=1699319030445497&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgft42AGpP3TDBkJfXUL-Qq_asadcZzLt10Wd4jFrVNOoCIQCJ7FKBs9Y2eg2KeZfn3ws6CHE5BL14X9IIhVWUGvwisQ%3D%3D&sig=ANLwegAwRQIhANme52XQHEAnO7LTInEYUNtjAMPxF8IaKzDf5FazTR3MAiAdQXMBPLbDPFLDfUGWQnBwzeVMTbqbLrnLybs6pgwQRQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d401e',
      //       videoCodec: 'avc1.4d401e',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '360p',
      //       bitrate: 367577,
      //       audioBitrate: null,
      //       itag: 243,
      //       width: 640,
      //       height: 360,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '533',
      //       },
      //       lastModified: '1699319010586720',
      //       contentLength: '3820875',
      //       quality: 'medium',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 314000,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=243&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=3820875&dur=97.347&lmt=1699319010586720&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRgIhALM5foVrxZNb2olzLxTHU5QggtlooOPSC7ZkDruQGZHqAiEAsiidq70hlP8HowANZsY-YWlL8N3N6MsM4TmCQ8pmR1Y%3D&sig=ANLwegAwRAIgIsAywPXSQqzA2kAgbMYL7eingcWGauJw0UKKujuXyYUCIGe8ZuhJNFUK83FZ64H_Q-lemLzy7kXWh9xSCZHp77Tg',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d4015"',
      //       qualityLabel: '240p',
      //       bitrate: 265745,
      //       audioBitrate: null,
      //       itag: 133,
      //       width: 426,
      //       height: 240,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319030336388',
      //       contentLength: '2864489',
      //       quality: 'small',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 235404,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=133&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=2864489&dur=97.347&lmt=1699319030336388&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgbDenY2DPNIMhXzKY_7fFjKj1U0qoxWulULdAi9zUQhcCIALUpAX9AcXBclOqIkWjJaeRInxUuLcbGaMeyFcjL3Nq&sig=ANLwegAwRAIgCq0Oc6e5FGgdBHc_VDqij9j_M7lmwmMRTt3A38cJZMoCIFMP4lZSE_7ICcQIPYA2HafB3jLfNd-dnhNHBrh0dk-p',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d4015',
      //       videoCodec: 'avc1.4d4015',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '240p',
      //       bitrate: 228950,
      //       audioBitrate: null,
      //       itag: 242,
      //       width: 426,
      //       height: 240,
      //       initRange: {
      //         start: '0',
      //         end: '218',
      //       },
      //       indexRange: {
      //         start: '219',
      //         end: '532',
      //       },
      //       lastModified: '1699319010471325',
      //       contentLength: '2423359',
      //       quality: 'small',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 199152,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=242&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=2423359&dur=97.347&lmt=1699319010471325&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgcG_9qBRUsWfVG6Grl7Zvk4MTKobBU38UGBUEgQ-KPxoCIAON7yGAyDRFF-ldXXUDdkoDzAqSKerQtsud5BBSkjhY&sig=ANLwegAwRQIhAJSsLbuj4WmYzFETIv09P5NbX05OR5dkz5FLFFDTYcfJAiAy0lCk_gLiCTqQ6qzrX6XbJSZhaYSDDWnn1PxsBrHunA%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d400c"',
      //       qualityLabel: '144p',
      //       bitrate: 121706,
      //       audioBitrate: null,
      //       itag: 160,
      //       width: 256,
      //       height: 144,
      //       initRange: {
      //         start: '0',
      //         end: '737',
      //       },
      //       indexRange: {
      //         start: '738',
      //         end: '997',
      //       },
      //       lastModified: '1699319030748921',
      //       contentLength: '1297478',
      //       quality: 'tiny',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 106627,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=160&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1297478&dur=97.347&lmt=1699319030748921&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAIVUXl7GhrzIklUZck5cCofBNCtBI_7yUJy8pWJls0XbAiBlMAyw6dhok_SLTpgBeWZvL7A7H9Cw6eI6zDyo0S1Lug%3D%3D&sig=ANLwegAwRgIhAIsy3IDPZGioAiQON-0Z6xdEyedN726anPjQfZAmlPsIAiEAk3JRm-eQi8mMoJLPazY4TNhgluNP0a8TRb3X-7gcTvc%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d400c',
      //       videoCodec: 'avc1.4d400c',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '144p',
      //       bitrate: 111277,
      //       audioBitrate: null,
      //       itag: 278,
      //       width: 256,
      //       height: 144,
      //       initRange: {
      //         start: '0',
      //         end: '217',
      //       },
      //       indexRange: {
      //         start: '218',
      //         end: '530',
      //       },
      //       lastModified: '1699319010469787',
      //       contentLength: '1215436',
      //       quality: 'tiny',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 99884,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=278&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1215436&dur=97.347&lmt=1699319010469787&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgHGasSIAHUoiBOYZIxZ7rfj4TCA6JnhgIGs2-5JuHjCMCIQDJHLIJ4rfAEvA3P9620eo16sGj9JgUsz-_fIzdvLZxAg%3D%3D&sig=ANLwegAwRAIffxrvNj8JGvM5rueuZijr8zTzfWsauEdZVWFUiHbbUwIhAJbwb1oPUQiv0rLS4esO1yNwsUIR2Gh9a3g4FBMEYUQT',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/webm; codecs="opus"',
      //       qualityLabel: null,
      //       bitrate: 131476,
      //       audioBitrate: 160,
      //       itag: 251,
      //       initRange: {
      //         start: '0',
      //         end: '265',
      //       },
      //       indexRange: {
      //         start: '266',
      //         end: '432',
      //       },
      //       lastModified: '1699319026662306',
      //       contentLength: '1559114',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 128083,
      //       audioQuality: 'AUDIO_QUALITY_MEDIUM',
      //       approxDurationMs: '97381',
      //       audioSampleRate: '48000',
      //       audioChannels: 2,
      //       loudnessDb: 0.69999981,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=251&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1559114&dur=97.381&lmt=1699319026662306&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgNJCga0Gi-Rbm0e-BhyTWVtSGQ6biu1TRvoUwiwehdIUCIQDecYkRu11A9qX_u9Q7McBr3N8f96r8SMzSTHiV6001Lw%3D%3D&sig=ANLwegAwRgIhAKqYA3z8bgy2ZKnMCh4j0XTmGs0DIbexswj-oriN3dSvAiEAhVpW23QeyCHwKI8P8WPaGMcfUe_MlTrQwKsHumnMyW8%3D',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'webm',
      //       codecs: 'opus',
      //       videoCodec: null,
      //       audioCodec: 'opus',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/mp4; codecs="mp4a.40.2"',
      //       qualityLabel: null,
      //       bitrate: 130340,
      //       audioBitrate: 128,
      //       itag: 140,
      //       initRange: {
      //         start: '0',
      //         end: '631',
      //       },
      //       indexRange: {
      //         start: '632',
      //         end: '783',
      //       },
      //       lastModified: '1699319006374987',
      //       contentLength: '1577291',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 129542,
      //       highReplication: true,
      //       audioQuality: 'AUDIO_QUALITY_MEDIUM',
      //       approxDurationMs: '97407',
      //       audioSampleRate: '44100',
      //       audioChannels: 2,
      //       loudnessDb: 0.71000004,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=140&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1577291&dur=97.407&lmt=1699319006374987&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgW4irP7hoQ9Q5FHNQAW8pXVIrR4aw826x1xlwRwEyulwCIFhQRwhsCeCrg5akX25k1vl1v0N9vUJp27LS6pXJ43SM&sig=ANLwegAwRAIgAdSc8wo2HCwJVq2BAEtxZ66vpl-rzqZL61m9kFZf388CIF5PqKlnZMPYqIQdHeNkgwkcdt-Z2ykzciBqlDB8Rmtv',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'mp4',
      //       codecs: 'mp4a.40.2',
      //       videoCodec: null,
      //       audioCodec: 'mp4a.40.2',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/webm; codecs="opus"',
      //       qualityLabel: null,
      //       bitrate: 66985,
      //       audioBitrate: 64,
      //       itag: 250,
      //       initRange: {
      //         start: '0',
      //         end: '265',
      //       },
      //       indexRange: {
      //         start: '266',
      //         end: '432',
      //       },
      //       lastModified: '1699319026681765',
      //       contentLength: '787797',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 64718,
      //       audioQuality: 'AUDIO_QUALITY_LOW',
      //       approxDurationMs: '97381',
      //       audioSampleRate: '48000',
      //       audioChannels: 2,
      //       loudnessDb: 0.69999981,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=250&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=787797&dur=97.381&lmt=1699319026681765&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgWPUJxm7KgCmwZcUSsicASeePJQetxx6boZFW6fCvyTwCIBrT11j7vtZTcNg89TSrcoT69mzQDMrTyiGKq1GnwkBq&sig=ANLwegAwRQIhAIOr_ti1jTcGMMdOTSiG8vP83pAIhdZwsiAbOUbmyIZVAiBiJCU041jw7lszCoLdJu_9uoNdsfyXfI1Dv84543RKIw%3D%3D',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'webm',
      //       codecs: 'opus',
      //       videoCodec: null,
      //       audioCodec: 'opus',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/webm; codecs="opus"',
      //       qualityLabel: null,
      //       bitrate: 50708,
      //       audioBitrate: 48,
      //       itag: 249,
      //       initRange: {
      //         start: '0',
      //         end: '265',
      //       },
      //       indexRange: {
      //         start: '266',
      //         end: '431',
      //       },
      //       lastModified: '1699319026622440',
      //       contentLength: '596831',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 49030,
      //       audioQuality: 'AUDIO_QUALITY_LOW',
      //       approxDurationMs: '97381',
      //       audioSampleRate: '48000',
      //       audioChannels: 2,
      //       loudnessDb: 0.69999981,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=249&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=596831&dur=97.381&lmt=1699319026622440&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRgIhAOn1dKeFsXUnMhP_1dGDtn4q1F399WSuxdBLu1alJIflAiEA36l3P_OZD5-xCIN42WF44Y_aLRA6gql0mPvJnfRcrdU%3D&sig=ANLwegAwRgIhALSN4co-JiNSvcFoY_kStrd_mcKvlszFJr7emQyoxxHpAiEAyKOOyKhVs6erfOTOdx59l5j7l7ZVu_Oyh77nFf1ET5U%3D',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'webm',
      //       codecs: 'opus',
      //       videoCodec: null,
      //       audioCodec: 'opus',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.64001F, mp4a.40.2"',
      //       qualityLabel: '720p',
      //       bitrate: 2018101,
      //       audioBitrate: 192,
      //       itag: 22,
      //       width: 1280,
      //       height: 720,
      //       lastModified: '1699319033013142',
      //       quality: 'hd720',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       audioQuality: 'AUDIO_QUALITY_MEDIUM',
      //       approxDurationMs: '97407',
      //       audioSampleRate: '44100',
      //       audioChannels: 2,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=22&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=SKzAWU4zU-zfxgthj-CHpOoP&cnr=14&ratebypass=yes&dur=97.407&lmt=1699319033013142&mt=1700386633&fvip=4&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=UHMuBwH3v8nfwA&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Ccnr%2Cratebypass%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgGrAgCoMTYosL6rwjjVJj11sNuKw2-SxCdqJ-o4oDnVgCIQCsh8kHXcdj8BGpMH85MloyTv5x7N35SvVD2RVdFWDZ2g%3D%3D&sig=ANLwegAwRAIgYdO-qI07gjckt2U8ZWHTyjsCRAa7JUUOOVLmnsSnB4kCIF0ylct0q3Fj-46OMo0UJiPm6WsijEVUEUbFv-9aEeSA',
      //       hasVideo: true,
      //       hasAudio: true,
      //       container: 'mp4',
      //       codecs: 'avc1.64001F, mp4a.40.2',
      //       videoCodec: 'avc1.64001F',
      //       audioCodec: 'mp4a.40.2',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //   ],
      // };

      const videoInfo =
        //  temp ||
        await ytdl.getInfo(videoUrl);

      const bestAudioOrVideo = (metadata) => {
        const tempObj: {
          [key: string]: {
            data: {
              itag: number;
              audioBitrate: number;
              bitrate: number;
              // url: string;
              // title: '';
            };
          };
        } = {};

        for (const x of metadata) {
          if (x.qualityLabel) {
            const { qualityLabel, itag, bitrate } = x;
            const audioBitrate = x.audioBitrate || 0;
            if (tempObj[qualityLabel] === undefined) {
              tempObj[qualityLabel] = {
                data: {
                  audioBitrate,
                  itag,
                  bitrate,
                  // url,
                },
              };
            }

            if (
              tempObj[qualityLabel].data.audioBitrate < audioBitrate &&
              tempObj[qualityLabel].data.audioBitrate === 0
            ) {
              tempObj[qualityLabel]['data'] = {
                audioBitrate,
                itag,
                bitrate,
                // url,
              };
            }

            if (
              tempObj[qualityLabel].data.bitrate < bitrate &&
              tempObj[qualityLabel].data.audioBitrate === 0
            ) {
              tempObj[qualityLabel]['data'] = {
                audioBitrate,
                itag,
                bitrate,
                // url,
              };
            }
          }
        }

        return tempObj;
      };

      const data = bestAudioOrVideo(videoInfo.formats);
      return { qualities: data, title: videoInfo.videoDetails.title };
    } catch (error) {
      this.errorLogger(error);
    }
  }

  async sendAvailableQualities1(dto: UrlValidation) {
    try {
      const { videoUrl } = dto;

      // const temp = {
      //   formats: [
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
      //       qualityLabel: '360p',
      //       bitrate: 557941,
      //       audioBitrate: 96,
      //       itag: 18,
      //       width: 640,
      //       height: 360,
      //       lastModified: '1699318984305620',
      //       contentLength: '6789241',
      //       quality: 'medium',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 557597,
      //       audioQuality: 'AUDIO_QUALITY_LOW',
      //       approxDurationMs: '97407',
      //       audioSampleRate: '44100',
      //       audioChannels: 2,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=18&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=SKzAWU4zU-zfxgthj-CHpOoP&gir=yes&clen=6789241&ratebypass=yes&dur=97.407&lmt=1699318984305620&mt=1700386633&fvip=4&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=UHMuBwH3v8nfwA&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cratebypass%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRgIhALOeYqB6sSYVaSTCFwdengoMFgdNHTeTBusg62MwSus9AiEA2pLyUXJuuLVO_ikNGpee4SmgmHtDEt7Obl74kQA23Ng%3D&sig=ANLwegAwRQIhAOLb9dWFAoQSsuhwiUBP8nGU2twKe_lhyH5mssd92xKcAiBKKH6znmEKTWAmLNM_L4nAu4vUniLzZhDzS017__peEQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: true,
      //       container: 'mp4',
      //       codecs: 'avc1.42001E, mp4a.40.2',
      //       videoCodec: 'avc1.42001E',
      //       audioCodec: 'mp4a.40.2',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.640028"',
      //       qualityLabel: '1080p',
      //       bitrate: 4472188,
      //       audioBitrate: null,
      //       itag: 137,
      //       width: 1920,
      //       height: 1080,
      //       initRange: {
      //         start: '0',
      //         end: '740',
      //       },
      //       indexRange: {
      //         start: '741',
      //         end: '1000',
      //       },
      //       lastModified: '1699319030219194',
      //       contentLength: '43122048',
      //       quality: 'hd1080',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 3543780,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=137&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=43122048&dur=97.347&lmt=1699319030219194&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhANaZ6mj8bPeI28g8MfB849RxdQOMw0X9VshUep9tN5XtAiAE8A_hJsG041nSQJGuQNMJvczqXjKokPnX0-aegM128Q%3D%3D&sig=ANLwegAwRAIgArcBfxThDEHaxwgp-D0XVbInTeh2RpqhRTCxJotZ9OYCIC0kYklxf5OHBoieiMO3NyaCn3EXExZC85pIRSFtynBr',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.640028',
      //       videoCodec: 'avc1.640028',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '1080p',
      //       bitrate: 1730823,
      //       audioBitrate: null,
      //       itag: 248,
      //       width: 1920,
      //       height: 1080,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '535',
      //       },
      //       lastModified: '1699319010793502',
      //       contentLength: '18508719',
      //       quality: 'hd1080',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 1521051,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=248&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=18508719&dur=97.347&lmt=1699319010793502&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAMltLWRNjRx4Vh7PIRihmm2PQG1UbReB93ZSYPlxvzbgAiBDt8spi2nFd8cKuQVfLZ6obCQubc5G6jpPZ55E7ycXpw%3D%3D&sig=ANLwegAwRAIgfPVnoWoD0kja4SWf4f3kZRbHZGVQaFyCvfWsnB99BzMCIE6D0Bpx25PDvEFw1G5A15xwvshguoPEQpdvZdIN5U8t',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.64001f"',
      //       qualityLabel: '720p',
      //       bitrate: 2166645,
      //       audioBitrate: null,
      //       itag: 136,
      //       width: 1280,
      //       height: 720,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319031042322',
      //       contentLength: '22989751',
      //       quality: 'hd720',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 1889303,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=136&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=22989751&dur=97.347&lmt=1699319031042322&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAI9Kus_OHJ4gO5m5xcLg1rHX2KwmqhL6l__LUsX3HYeNAiA5GEz0gScwL23dt68oOtY0gIXOpMO_5k5tAp0vCvb8lg%3D%3D&sig=ANLwegAwRQIhAP5auxqoJ5Ay9q16cwLYsuR6xiakS9rUWVhSqMDH7mN_AiAVvBFNaR9M7bFITX38UgaSyqRZmIOh5n5jgqQxyUaRyQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.64001f',
      //       videoCodec: 'avc1.64001f',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '720p',
      //       bitrate: 1137926,
      //       audioBitrate: null,
      //       itag: 247,
      //       width: 1280,
      //       height: 720,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '533',
      //       },
      //       lastModified: '1699319011059865',
      //       contentLength: '11423973',
      //       quality: 'hd720',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 938824,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=247&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=11423973&dur=97.347&lmt=1699319011059865&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgCeF0LFTH2No3mqvDGOsJD06kmYz4oeDRgcuW_voYjgICIH42iuJPBGsrQr4s4cIgByCY9MKG7LLLn9kAjcHVkBXW&sig=ANLwegAwRQIhANtgFuqE_3xOKQNkY-RyvtzF0ktthL-r6j7pwnCndo5DAiAej1r14JPN50LqvavpgbTl2JJBec0mFWfAJHEvZz_YqQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d401e"',
      //       qualityLabel: '480p',
      //       bitrate: 1131290,
      //       audioBitrate: null,
      //       itag: 135,
      //       width: 854,
      //       height: 480,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319030615375',
      //       contentLength: '11951658',
      //       quality: 'large',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 982190,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=135&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=11951658&dur=97.347&lmt=1699319030615375&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhALVO1pN3XSXYvv2DtZJOPjLYRcbQ7hVdWTBTPCbriOIWAiAeg27Za5iJt1l1Jimj45HzzX9mu4m09be20gwK_OFabA%3D%3D&sig=ANLwegAwRQIgBvdpGCOomm_mHdrvn5EGFtm3ta_T1bWjCfnP53MLkEMCIQDBozkpe80jOxn4ZiHByQUHCMPgvXWZD1KzuDePTodfPA%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d401e',
      //       videoCodec: 'avc1.4d401e',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '480p',
      //       bitrate: 646654,
      //       audioBitrate: null,
      //       itag: 244,
      //       width: 854,
      //       height: 480,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '533',
      //       },
      //       lastModified: '1699319010662731',
      //       contentLength: '6834998',
      //       quality: 'large',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 561701,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=244&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=6834998&dur=97.347&lmt=1699319010662731&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAJH5NwOMmKO1RpRVh6w3JYb43sS41sV0DK3JyaaEkRpvAiBRx5IRYj3Tw_wUZ8W0Q6T9wB7QXkE-qyuQSiOfSwtnXA%3D%3D&sig=ANLwegAwRgIhAKbmKLm0Q2QGjy3CkRi2-f7weLsWx3lJ73SDaspCRnzaAiEAi6-2Lw6tBeCjCXVh_QutTVVJN3jeEPr5S7NklGx46d8%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d401e"',
      //       qualityLabel: '360p',
      //       bitrate: 598150,
      //       audioBitrate: null,
      //       itag: 134,
      //       width: 640,
      //       height: 360,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319030445497',
      //       contentLength: '5652164',
      //       quality: 'medium',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 464496,
      //       highReplication: true,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=134&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=5652164&dur=97.347&lmt=1699319030445497&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgft42AGpP3TDBkJfXUL-Qq_asadcZzLt10Wd4jFrVNOoCIQCJ7FKBs9Y2eg2KeZfn3ws6CHE5BL14X9IIhVWUGvwisQ%3D%3D&sig=ANLwegAwRQIhANme52XQHEAnO7LTInEYUNtjAMPxF8IaKzDf5FazTR3MAiAdQXMBPLbDPFLDfUGWQnBwzeVMTbqbLrnLybs6pgwQRQ%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d401e',
      //       videoCodec: 'avc1.4d401e',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '360p',
      //       bitrate: 367577,
      //       audioBitrate: null,
      //       itag: 243,
      //       width: 640,
      //       height: 360,
      //       initRange: {
      //         start: '0',
      //         end: '219',
      //       },
      //       indexRange: {
      //         start: '220',
      //         end: '533',
      //       },
      //       lastModified: '1699319010586720',
      //       contentLength: '3820875',
      //       quality: 'medium',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 314000,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=243&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=3820875&dur=97.347&lmt=1699319010586720&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRgIhALM5foVrxZNb2olzLxTHU5QggtlooOPSC7ZkDruQGZHqAiEAsiidq70hlP8HowANZsY-YWlL8N3N6MsM4TmCQ8pmR1Y%3D&sig=ANLwegAwRAIgIsAywPXSQqzA2kAgbMYL7eingcWGauJw0UKKujuXyYUCIGe8ZuhJNFUK83FZ64H_Q-lemLzy7kXWh9xSCZHp77Tg',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d4015"',
      //       qualityLabel: '240p',
      //       bitrate: 265745,
      //       audioBitrate: null,
      //       itag: 133,
      //       width: 426,
      //       height: 240,
      //       initRange: {
      //         start: '0',
      //         end: '738',
      //       },
      //       indexRange: {
      //         start: '739',
      //         end: '998',
      //       },
      //       lastModified: '1699319030336388',
      //       contentLength: '2864489',
      //       quality: 'small',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 235404,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=133&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=2864489&dur=97.347&lmt=1699319030336388&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgbDenY2DPNIMhXzKY_7fFjKj1U0qoxWulULdAi9zUQhcCIALUpAX9AcXBclOqIkWjJaeRInxUuLcbGaMeyFcjL3Nq&sig=ANLwegAwRAIgCq0Oc6e5FGgdBHc_VDqij9j_M7lmwmMRTt3A38cJZMoCIFMP4lZSE_7ICcQIPYA2HafB3jLfNd-dnhNHBrh0dk-p',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d4015',
      //       videoCodec: 'avc1.4d4015',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '240p',
      //       bitrate: 228950,
      //       audioBitrate: null,
      //       itag: 242,
      //       width: 426,
      //       height: 240,
      //       initRange: {
      //         start: '0',
      //         end: '218',
      //       },
      //       indexRange: {
      //         start: '219',
      //         end: '532',
      //       },
      //       lastModified: '1699319010471325',
      //       contentLength: '2423359',
      //       quality: 'small',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 199152,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=242&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=2423359&dur=97.347&lmt=1699319010471325&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgcG_9qBRUsWfVG6Grl7Zvk4MTKobBU38UGBUEgQ-KPxoCIAON7yGAyDRFF-ldXXUDdkoDzAqSKerQtsud5BBSkjhY&sig=ANLwegAwRQIhAJSsLbuj4WmYzFETIv09P5NbX05OR5dkz5FLFFDTYcfJAiAy0lCk_gLiCTqQ6qzrX6XbJSZhaYSDDWnn1PxsBrHunA%3D%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.4d400c"',
      //       qualityLabel: '144p',
      //       bitrate: 121706,
      //       audioBitrate: null,
      //       itag: 160,
      //       width: 256,
      //       height: 144,
      //       initRange: {
      //         start: '0',
      //         end: '737',
      //       },
      //       indexRange: {
      //         start: '738',
      //         end: '997',
      //       },
      //       lastModified: '1699319030748921',
      //       contentLength: '1297478',
      //       quality: 'tiny',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 106627,
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=160&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1297478&dur=97.347&lmt=1699319030748921&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5319224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIhAIVUXl7GhrzIklUZck5cCofBNCtBI_7yUJy8pWJls0XbAiBlMAyw6dhok_SLTpgBeWZvL7A7H9Cw6eI6zDyo0S1Lug%3D%3D&sig=ANLwegAwRgIhAIsy3IDPZGioAiQON-0Z6xdEyedN726anPjQfZAmlPsIAiEAk3JRm-eQi8mMoJLPazY4TNhgluNP0a8TRb3X-7gcTvc%3D',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'mp4',
      //       codecs: 'avc1.4d400c',
      //       videoCodec: 'avc1.4d400c',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/webm; codecs="vp9"',
      //       qualityLabel: '144p',
      //       bitrate: 111277,
      //       audioBitrate: null,
      //       itag: 278,
      //       width: 256,
      //       height: 144,
      //       initRange: {
      //         start: '0',
      //         end: '217',
      //       },
      //       indexRange: {
      //         start: '218',
      //         end: '530',
      //       },
      //       lastModified: '1699319010469787',
      //       contentLength: '1215436',
      //       quality: 'tiny',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 99884,
      //       colorInfo: {
      //         primaries: 'COLOR_PRIMARIES_BT709',
      //         transferCharacteristics: 'COLOR_TRANSFER_CHARACTERISTICS_BT709',
      //         matrixCoefficients: 'COLOR_MATRIX_COEFFICIENTS_BT709',
      //       },
      //       approxDurationMs: '97347',
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=278&aitags=133%2C134%2C135%2C136%2C137%2C160%2C242%2C243%2C244%2C247%2C248%2C278&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1215436&dur=97.347&lmt=1699319010469787&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=531F224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Caitags%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgHGasSIAHUoiBOYZIxZ7rfj4TCA6JnhgIGs2-5JuHjCMCIQDJHLIJ4rfAEvA3P9620eo16sGj9JgUsz-_fIzdvLZxAg%3D%3D&sig=ANLwegAwRAIffxrvNj8JGvM5rueuZijr8zTzfWsauEdZVWFUiHbbUwIhAJbwb1oPUQiv0rLS4esO1yNwsUIR2Gh9a3g4FBMEYUQT',
      //       hasVideo: true,
      //       hasAudio: false,
      //       container: 'webm',
      //       codecs: 'vp9',
      //       videoCodec: 'vp9',
      //       audioCodec: null,
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/webm; codecs="opus"',
      //       qualityLabel: null,
      //       bitrate: 131476,
      //       audioBitrate: 160,
      //       itag: 251,
      //       initRange: {
      //         start: '0',
      //         end: '265',
      //       },
      //       indexRange: {
      //         start: '266',
      //         end: '432',
      //       },
      //       lastModified: '1699319026662306',
      //       contentLength: '1559114',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 128083,
      //       audioQuality: 'AUDIO_QUALITY_MEDIUM',
      //       approxDurationMs: '97381',
      //       audioSampleRate: '48000',
      //       audioChannels: 2,
      //       loudnessDb: 0.69999981,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=251&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1559114&dur=97.381&lmt=1699319026662306&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgNJCga0Gi-Rbm0e-BhyTWVtSGQ6biu1TRvoUwiwehdIUCIQDecYkRu11A9qX_u9Q7McBr3N8f96r8SMzSTHiV6001Lw%3D%3D&sig=ANLwegAwRgIhAKqYA3z8bgy2ZKnMCh4j0XTmGs0DIbexswj-oriN3dSvAiEAhVpW23QeyCHwKI8P8WPaGMcfUe_MlTrQwKsHumnMyW8%3D',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'webm',
      //       codecs: 'opus',
      //       videoCodec: null,
      //       audioCodec: 'opus',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/mp4; codecs="mp4a.40.2"',
      //       qualityLabel: null,
      //       bitrate: 130340,
      //       audioBitrate: 128,
      //       itag: 140,
      //       initRange: {
      //         start: '0',
      //         end: '631',
      //       },
      //       indexRange: {
      //         start: '632',
      //         end: '783',
      //       },
      //       lastModified: '1699319006374987',
      //       contentLength: '1577291',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 129542,
      //       highReplication: true,
      //       audioQuality: 'AUDIO_QUALITY_MEDIUM',
      //       approxDurationMs: '97407',
      //       audioSampleRate: '44100',
      //       audioChannels: 2,
      //       loudnessDb: 0.71000004,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=140&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fmp4&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=1577291&dur=97.407&lmt=1699319006374987&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgW4irP7hoQ9Q5FHNQAW8pXVIrR4aw826x1xlwRwEyulwCIFhQRwhsCeCrg5akX25k1vl1v0N9vUJp27LS6pXJ43SM&sig=ANLwegAwRAIgAdSc8wo2HCwJVq2BAEtxZ66vpl-rzqZL61m9kFZf388CIF5PqKlnZMPYqIQdHeNkgwkcdt-Z2ykzciBqlDB8Rmtv',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'mp4',
      //       codecs: 'mp4a.40.2',
      //       videoCodec: null,
      //       audioCodec: 'mp4a.40.2',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/webm; codecs="opus"',
      //       qualityLabel: null,
      //       bitrate: 66985,
      //       audioBitrate: 64,
      //       itag: 250,
      //       initRange: {
      //         start: '0',
      //         end: '265',
      //       },
      //       indexRange: {
      //         start: '266',
      //         end: '432',
      //       },
      //       lastModified: '1699319026681765',
      //       contentLength: '787797',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 64718,
      //       audioQuality: 'AUDIO_QUALITY_LOW',
      //       approxDurationMs: '97381',
      //       audioSampleRate: '48000',
      //       audioChannels: 2,
      //       loudnessDb: 0.69999981,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=250&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=787797&dur=97.381&lmt=1699319026681765&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRAIgWPUJxm7KgCmwZcUSsicASeePJQetxx6boZFW6fCvyTwCIBrT11j7vtZTcNg89TSrcoT69mzQDMrTyiGKq1GnwkBq&sig=ANLwegAwRQIhAIOr_ti1jTcGMMdOTSiG8vP83pAIhdZwsiAbOUbmyIZVAiBiJCU041jw7lszCoLdJu_9uoNdsfyXfI1Dv84543RKIw%3D%3D',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'webm',
      //       codecs: 'opus',
      //       videoCodec: null,
      //       audioCodec: 'opus',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'audio/webm; codecs="opus"',
      //       qualityLabel: null,
      //       bitrate: 50708,
      //       audioBitrate: 48,
      //       itag: 249,
      //       initRange: {
      //         start: '0',
      //         end: '265',
      //       },
      //       indexRange: {
      //         start: '266',
      //         end: '431',
      //       },
      //       lastModified: '1699319026622440',
      //       contentLength: '596831',
      //       quality: 'tiny',
      //       projectionType: 'RECTANGULAR',
      //       averageBitrate: 49030,
      //       audioQuality: 'AUDIO_QUALITY_LOW',
      //       approxDurationMs: '97381',
      //       audioSampleRate: '48000',
      //       audioChannels: 2,
      //       loudnessDb: 0.69999981,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=249&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=audio%2Fwebm&ns=dSI1P65qtNb284jvT6xAf8UP&gir=yes&clen=596831&dur=97.381&lmt=1699319026622440&mt=1700386633&fvip=4&keepalive=yes&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=22Dp6o5A7QRkuQ&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRgIhAOn1dKeFsXUnMhP_1dGDtn4q1F399WSuxdBLu1alJIflAiEA36l3P_OZD5-xCIN42WF44Y_aLRA6gql0mPvJnfRcrdU%3D&sig=ANLwegAwRgIhALSN4co-JiNSvcFoY_kStrd_mcKvlszFJr7emQyoxxHpAiEAyKOOyKhVs6erfOTOdx59l5j7l7ZVu_Oyh77nFf1ET5U%3D',
      //       hasVideo: false,
      //       hasAudio: true,
      //       container: 'webm',
      //       codecs: 'opus',
      //       videoCodec: null,
      //       audioCodec: 'opus',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //     {
      //       mimeType: 'video/mp4; codecs="avc1.64001F, mp4a.40.2"',
      //       qualityLabel: '720p',
      //       bitrate: 2018101,
      //       audioBitrate: 192,
      //       itag: 22,
      //       width: 1280,
      //       height: 720,
      //       lastModified: '1699319033013142',
      //       quality: 'hd720',
      //       fps: 24,
      //       projectionType: 'RECTANGULAR',
      //       audioQuality: 'AUDIO_QUALITY_MEDIUM',
      //       approxDurationMs: '97407',
      //       audioSampleRate: '44100',
      //       audioChannels: 2,
      //       url: 'https://rr1---sn-gwpa-civy.googlevideo.com/videoplayback?expire=1700408508&ei=XNhZZajUELbN2roPu_awwAQ&ip=2409%3A40c4%3A0%3Aad8b%3Ab177%3A7367%3A587d%3Ad1be&id=o-AHQiCiU8ydJ0CEgbezNPurMI-ICH14wke4ElsFwIQIZC&itag=22&source=youtube&requiressl=yes&mh=3l&mm=31%2C29&mn=sn-gwpa-civy%2Csn-gwpa-pmhd&ms=au%2Crdu&mv=m&mvi=1&pl=36&initcwndbps=281250&spc=UWF9f6VCPvl6dj2AFPyeSTlL7Ym8tf4HcMFcv3KEpg&vprv=1&svpuc=1&mime=video%2Fmp4&ns=SKzAWU4zU-zfxgthj-CHpOoP&cnr=14&ratebypass=yes&dur=97.407&lmt=1699319033013142&mt=1700386633&fvip=4&fexp=24007246&beids=24350018&c=WEB&txp=5318224&n=UHMuBwH3v8nfwA&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cspc%2Cvprv%2Csvpuc%2Cmime%2Cns%2Ccnr%2Cratebypass%2Cdur%2Clmt&lsparams=mh%2Cmm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AM8Gb2swRQIgGrAgCoMTYosL6rwjjVJj11sNuKw2-SxCdqJ-o4oDnVgCIQCsh8kHXcdj8BGpMH85MloyTv5x7N35SvVD2RVdFWDZ2g%3D%3D&sig=ANLwegAwRAIgYdO-qI07gjckt2U8ZWHTyjsCRAa7JUUOOVLmnsSnB4kCIF0ylct0q3Fj-46OMo0UJiPm6WsijEVUEUbFv-9aEeSA',
      //       hasVideo: true,
      //       hasAudio: true,
      //       container: 'mp4',
      //       codecs: 'avc1.64001F, mp4a.40.2',
      //       videoCodec: 'avc1.64001F',
      //       audioCodec: 'mp4a.40.2',
      //       isLive: false,
      //       isHLS: false,
      //       isDashMPD: false,
      //     },
      //   ],
      // };

      const videoInfo =
        //  temp ||
        await ytdl.getInfo(videoUrl);

      return videoInfo;
    } catch (error) {
      this.errorLogger(error);
    }
  }

  // async downloadVideo(dto: DownloadVideo) {
  //   const { itag, videoUrl, hasAudio } = dto;

  //   const uniqueId = randomUUID();

  //   if (hasAudio === false) {
  //     ytdl(videoUrl, { filter: (format) => format.itag === itag })
  //       .pipe(fs.createWriteStream(`${uniqueId}.mp4`))
  //       .on('finish', () => {
  //         console.log('Video downloaded successfully!');
  //       })
  //       .on('error', (err) => {
  //         console.error('Error downloading video:', err);
  //       });
  //   }

  //   return { itag, videoUrl, hasAudio };
  // }

  @Cron(CronExpression.EVERY_10_MINUTES)
  handleDownload() {
    const fiveMinutes: number = 5 * 60 * 1000;
    const now = Date.now();

    fs.readdir('./downloads', (err, data) => {
      if (err) throw err;
      data.map((item) => {
        fs.stat('./downloads/' + item, (err, stats) => {
          // console.log(now - stats?.birthtime.getTime() > fiveMinutes);
          if (now - stats?.birthtime.getTime() > fiveMinutes) {
            fs.unlink('./downloads/' + item, (err) => {
              if (err) throw err;
            });
          }
        });
      });
    });
  }

  downloadVideo111(dto: UrlValidation) {
    // ytdl(dto.videoUrl).pipe(fs.createWriteStream('bakwasVideo.mp4'));

    videoD(dto.videoUrl).pipe(
      require('fs').createWriteStream('newVideoPideo.mp4'),
    );

    return { message: 'Video downloaded successfully!' };
  }

  private createDownloadsDirectory(): void {
    const downloadsPath = './downloads';

    fs.mkdir(downloadsPath, { recursive: true }, (err) => {
      if (err) {
        if (err.code === 'EEXIST') {
          console.log("'downloads' directory already exists.");
        } else {
          console.error('Error creating directory:', err);
        }
      } else {
        console.log("'downloads' directory created successfully!");
      }
    });
  }
}
