import { Module} from '@nestjs/common'
import { AuthModule } from './auth' // Auth Module


@Module({
  imports: [
    AuthModule,
  ]
})
export class AppModule {
}
