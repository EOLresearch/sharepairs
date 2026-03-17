import { Injectable } from '@nestjs/common';
import {
  DynamoDBClient as AwsDynamoClient,
} from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDbClient {
  private readonly client: DynamoDBDocumentClient;

  constructor() {
    const awsClient = new AwsDynamoClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });

    this.client = DynamoDBDocumentClient.from(awsClient, {
      marshallOptions: {
        removeUndefinedValues: true,
      },
    });
  }

  get(params: any) {
    return this.client.send(new GetCommand(params));
  }

  put(params: any) {
    return this.client.send(new PutCommand(params));
  }

  query(params: any) {
    return this.client.send(new QueryCommand(params));
  }

  delete(params: any) {
    return this.client.send(new DeleteCommand(params));
  }
}
