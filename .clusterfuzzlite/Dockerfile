# ClusterFuzzLite / OSS-Fuzz build image (language: javascript).
# Pin the base image by digest at registration time — the digest below is
# a placeholder the maintainer replaces when opening the OSS-Fuzz PR
# (see docs/oss-fuzz-application.md). Until then ClusterFuzzLite resolves
# the tag in-CI.
FROM gcr.io/oss-fuzz-base/base-builder-javascript

COPY . $SRC/agentline
WORKDIR $SRC/agentline
COPY .clusterfuzzlite/build.sh $SRC/build.sh
