# ClusterFuzzLite / OSS-Fuzz build image (language: javascript).
# Base image pinned by digest (OpenSSF Scorecard Pinned-Dependencies).
# Refresh the digest with:
#   docker buildx imagetools inspect gcr.io/oss-fuzz-base/base-builder-javascript --format '{{.Manifest.Digest}}'
# and update the OSS-Fuzz PR to match (see docs/oss-fuzz-application.md).
FROM gcr.io/oss-fuzz-base/base-builder-javascript@sha256:f05620a579e43f637412a7e98802137e66313757e18bf6a7611564372e66bae6

COPY . $SRC/agentline
WORKDIR $SRC/agentline
COPY .clusterfuzzlite/build.sh $SRC/build.sh
