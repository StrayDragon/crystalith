ARG ALPINE_IMAGE=alpine:3.21

FROM ${ALPINE_IMAGE}

RUN apk add --no-cache socat

ENTRYPOINT ["/bin/sh", "-c"]
CMD ["echo '[host-remap] No command specified'; sleep infinity"]
