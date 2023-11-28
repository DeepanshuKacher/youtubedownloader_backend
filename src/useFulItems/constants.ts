import { ConfigService } from '@nestjs/config';

const config = new ConfigService();

const enviornment = config.get('enviornment');

const env_prod = enviornment === 'production';
const env_dev = enviornment === 'development';

export { env_dev, env_prod };
