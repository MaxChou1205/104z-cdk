import properties from "../env.json";
import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cloudfront_origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as route53 from "aws-cdk-lib/aws-route53";
import { BlockPublicAccess, Bucket } from "aws-cdk-lib/aws-s3";

export class FeStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // *********************************************************************
    // * Step 1.                                                           *
    // * get ssm parameter                                                 *
    // *********************************************************************
    // valueForStringParameter ( for dummy-value-for-)
    const ssmAcmArn = ssm.StringParameter.valueForStringParameter(
      this,
      "/acm/maxchou1205/arn"
    );
    const acmCert = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      ssmAcmArn
    );

    // *********************************************************************
    // * Step 2.                                                           *
    // * create S3 bucket and CloudFront                                   *
    // *********************************************************************
    for (const [idx, project] of properties.projects.entries()) {
      const bucketName = project.s3_bucket;
      const domain = project.cloudfront_cname;

      // create S3 buket
      const S3Buckat = new Bucket(this, "zteam-S3Bucket" + idx, {
        bucketName: bucketName,
        blockPublicAccess: BlockPublicAccess.BLOCK_ALL
      });

      // create access identity
      const originAccessIdentity = new cloudfront.OriginAccessIdentity(
        this,
        "zteam-S3BuckatOriginAccessIdentity" + idx
      );
      S3Buckat.grantRead(originAccessIdentity);

      // create CloudFront
      const cf = new cloudfront.Distribution(this, "zteam-Distribution" + idx, {
        domainNames: [domain],
        defaultRootObject: "index.html",
        // webAclId:
        //     : ssmGlobalWafArn, // todo
        certificate: acmCert, // todo
        defaultBehavior: {
          origin: new cloudfront_origins.S3Origin(S3Buckat, {
            originAccessIdentity: originAccessIdentity
          }),
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
        },
        errorResponses: [
          {
            httpStatus: 403,
            ttl: cdk.Duration.seconds(60),
            responsePagePath: "/index.html",
            responseHttpStatus: 200
          },
          {
            httpStatus: 404,
            ttl: cdk.Duration.seconds(300),
            responsePagePath: "/index.html",
            responseHttpStatus: 200
          }
        ]
      });

      // create ssm with distributionId
      new ssm.StringParameter(
        this,
        `ssm-cloudfront-distribution-id-${domain}`,
        {
          parameterName: `/cloudfront/${domain}/distribution/id`,
          stringValue: cf.distributionId
        }
      );

      // create domain A type and alias to CloudFront
      const recordSet = new route53.CfnRecordSet(
        this,
        "zteam-RecordSet" + idx,
        {
          hostedZoneName: properties.hosted_zone_name,
          name: domain,
          type: "A",
          aliasTarget: {
            dnsName: cf.distributionDomainName,
            hostedZoneId: "Z2FDTNDATAQYW2" //https://stackoverflow.com/questions/39665214/get-hosted-zone-for-cloudfront-distribution
          }
        }
      );
    }
  }
}
