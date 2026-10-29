// file cấu hình module database, gồm controller, service và các dependency liên quan.
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { entities } from './entities';
import { mysqlSsl } from './ssl';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',

        host: config.get<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT')),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_NAME'),

        // Kết nối SSL tới Aiven MySQL; DB_CA_CERT bật kiểm tra chứng chỉ.
        ssl: mysqlSsl(config.get<string>('DB_CA_CERT')),

        entities,
        // Schema changes go through the additive setup scripts before application startup.
        synchronize: config.get<string>('DB_SYNCHRONIZE', 'false') === 'true',
        charset: 'utf8mb4',
        supportBigNumbers: true,
        bigNumberStrings: false,
      }),
    }),
  ],
})
export class DatabaseModule {}
