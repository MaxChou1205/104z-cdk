import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";

export class SelfPipelineStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const pipeline = new cdk.aws_codepipeline.Pipeline(this, "cdk-pipeline", {
      pipelineName: "zteam-pipeline",
      restartExecutionOnUpdate: true
    });

    const cdkSourceOutput = new codepipeline.Artifact("CDKSourceOutput");
    pipeline.addStage({
      stageName: "Source",
      actions: [
        new codepipeline_actions.GitHubSourceAction({
          actionName: "Pipeline_Source",
          owner: "MaxChou1205",
          repo: "104z-cdk",
          branch: "master",
          oauthToken: cdk.SecretValue.secretsManager("github-pipeline-token"),
          output: cdkSourceOutput
        })
      ]
    });

    const cdkBuildOutput = new codepipeline.Artifact("CdkBuildOutput");
    const codebuildProject = new codebuild.PipelineProject(
      this,
      "CdkBuildProject",
      {
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
          computeType: codebuild.ComputeType.SMALL,
          privileged: true
        },
        buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec.yml")
      }
    );
    // codebuildProject.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: [
    //       "cloudfront:CreateInvalidation",
    //       "cloudfront:GetInvalidation",
    //       "cloudfront:ListInvalidations"
    //     ],
    //     resources: ["*"]
    //   })
    // );
    // codebuildProject.addToRolePolicy(
    //   new PolicyStatement({
    //     actions: [
    //       "s3:GetObject",
    //       "s3:ListBucket",
    //       "s3:ListObject",
    //       "s3:GetObjectVersion",
    //       "s3:PutObject",
    //       "s3:DeleteObject"
    //     ],
    //     resources: ["*"]
    //   })
    // );
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: "CDK_Build",
          input: cdkSourceOutput,
          outputs: [cdkBuildOutput],
          project: codebuildProject
        })
      ]
    });

    // pipeline.addStage({
    //   stageName: "Pipeline_Update",
    //   actions: [
    //     new  CloudFormationCreateUpdateStackAction({
    //       actionName: "Pipeline_Update",
    //       stackName: "SampleAppStack",
    //       templatePath: this.cdkBuildOutput.atPath(
    //         "SampleAppStack.template.json"
    //       ),
    //       adminPermissions: true
    //     })
    //   ]
    // });
  }
}
