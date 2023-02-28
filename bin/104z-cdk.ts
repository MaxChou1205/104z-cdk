#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { FeStack } from "../lib/fe-stack";
import { CodePipelineStack } from "../lib/codepipeline-stack";
import { SelfPipelineStack } from "../lib/self-pipeline-stack";

const app = new cdk.App();

new FeStack(app, "fe-stack");
new CodePipelineStack(app, "pipeline-stack");
new SelfPipelineStack(app, "self-pipeline-stack");
