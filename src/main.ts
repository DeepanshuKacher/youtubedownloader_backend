import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
// import { env_dev } from './useFulItems';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new ConfigService();

  // enviornment=development #development production

  const enviornment = config.get('enviornment');

  if (enviornment === 'development') app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true /* this is required */,
      forbidNonWhitelisted: true /* not working without whitelist:true */,
    }),
  );
  await app.listen(3000);
}
bootstrap();
