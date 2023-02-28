import properties from "../env.json";
import * as cdk from "aws-cdk-lib";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";

let pipeline_project = "";

export class CodePipelineStack extends cdk.Stack {
  private codestarConnections;
  private ssmCloudFrontDistributionId;
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // *********************************************************************
    // * Step 1.                                                           *
    // * get ssm parameter                                                 *
    // *********************************************************************
    this.codestarConnections = ssm.StringParameter.valueForStringParameter(
      this,
      "/codestar-connections/github/arn"
    );

    // *********************************************************************
    // * Step 2.                                                           *
    // * create codestar                                                   *
    // *********************************************************************
    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();

    for (const [idx, project] of properties.projects.entries()) {
      pipeline_project = project.pipeline;
      const bucketName = project.s3_bucket;
      const domain = project.cloudfront_cname;
      const github_repo = project.github_repo;
      this.ssmCloudFrontDistributionId =
        ssm.StringParameter.valueForStringParameter(
          this,
          `/cloudfront/${domain}/distribution/id`
        );
      // const artifacts_s3_bucket =
      //   properties.adsmart_codestar_stack.artifacts_s3_buckets[idx];

      let sourceActionInstance = this.createSourceAction(
        sourceOutput,
        github_repo,
        properties.branch
      );
      let codebuildInstance = this.createCodeBuild("");
      this.addRolePolicy(codebuildInstance);
      let codebuildActionInstance = this.createCodeBuildAction(
        "",
        sourceOutput,
        buildOutput,
        codebuildInstance,
        bucketName
      );
      let pipeline = this.createPipeline(
        "",
        sourceActionInstance,
        codebuildActionInstance
      );
    }
  }

  // private createSourceAction(
  //   suffixName: string,
  //   sourceOutput: any,
  //   github_repo: any,
  //   branch: any
  // ): codepipeline_actions.CodeStarConnectionsSourceAction {
  //   const sourceAction =
  //     new codepipeline_actions.CodeStarConnectionsSourceAction({
  //       actionName: "source-github",
  //       connectionArn: this.getSSM("codestarConnections"),
  //       output: sourceOutput,
  //       owner: "104corp",
  //       repo: github_repo,
  //       branch: branch
  //     });
  //   return sourceAction;
  // }

  private createSourceAction(
    sourceOutput: any,
    github_repo: any,
    branch: any
  ): codepipeline_actions.CodeStarConnectionsSourceAction {
    const sourceActionInstance =
      new codepipeline_actions.CodeStarConnectionsSourceAction({
        actionName: "source-github",
        connectionArn: this.codestarConnections,
        output: sourceOutput,
        owner: "104corp",
        repo: github_repo,
        branch: branch
      });
    return sourceActionInstance;
  }

  private createCodeBuild(suffixNmae: string): codebuild.PipelineProject {
    const codebuildInstance = new codebuild.PipelineProject(
      this,
      pipeline_project + "-Codebuild" + suffixNmae,
      {
        projectName: pipeline_project + "-codebuild" + suffixNmae,
        // logging: {
        //   cloudWatch: {
        //     logGroup: new LogGroup(this, 'logs-'+pipeline_project+'-codebuild'+suffixNmae, {
        //       logGroupName: '/codebuild/'+pipeline_project+'-codebuild'+suffixNmae,
        //       retention:properties.log_retention
        //     })
        //   }
        // },
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
          computeType: codebuild.ComputeType.SMALL,
          privileged: true
        }
      }
    );

    return codebuildInstance;
  }

  private createCodeBuildAction(
    suffixName: string,
    sourceOutput: any,
    buildOutput: any,
    codebuildObj: any,
    bucketName: string
  ): codepipeline_actions.CodeBuildAction {
    const codebuildActionInstance = new codepipeline_actions.CodeBuildAction({
      actionName: pipeline_project + "-codebuild-action" + suffixName,
      input: sourceOutput,
      outputs: [buildOutput],
      project: codebuildObj,
      environmentVariables: {
        ENV: { value: properties.env },
        DEPLOY_BUCKET_NAME: { value: bucketName },
        CLOUDFRONT_DISTRIBUTION_ID: {
          value: this.ssmCloudFrontDistributionId
        }
      }
    });
    return codebuildActionInstance;
  }

  private createPipeline(
    suffixName: string,
    sourceAction: any,
    codebuildAction: any
  ): codepipeline.Pipeline {
    const pipelineInstance = new codepipeline.Pipeline(
      this,
      pipeline_project + "-Pipeline" + suffixName,
      {
        pipelineName: pipeline_project + "-pipeline" + suffixName,
        crossAccountKeys: false,
        stages: [
          {
            stageName: "Source",
            actions: [sourceAction]
          },
          {
            stageName: "Build",
            actions: [codebuildAction]
          }
        ]
      }
    );
    return pipelineInstance;
  }

  private addRolePolicy(
    codebuildInstance: codebuild.PipelineProject
  ): codebuild.PipelineProject {
    codebuildInstance.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetInvalidation",
          "cloudfront:ListInvalidations"
        ],
        resources: [
          "arn:aws:cloudfront::*:distribution/" +
            this.ssmCloudFrontDistributionId
        ]
      })
    );
    codebuildInstance.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "s3:GetObject",
          "s3:ListBucket",
          "s3:ListObject",
          "s3:GetObjectVersion",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        resources: ["*"]
      })
    );

    return codebuildInstance;
  }
}
