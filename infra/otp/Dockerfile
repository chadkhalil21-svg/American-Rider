# OpenTripPlanner 2.10.0 for South Florida — serving image.
#
# This image SERVES a graph; it does not build one. Building needs the 660 MB Florida map,
# osmium, and 6 GB of memory, none of which belong on a 4 GB web instance. Build the graph
# with infra/otp/build.sh and put graph.obj where this container can find it:
#   - on the persistent disk mounted at /var/otp (Render: "Disks", or scp on a plain server), or
#   - at an HTTPS URL given as GRAPH_URL (object storage); the container downloads it once
#     to /var/otp and reuses it on every later start.
#
# OTP 2.10.0 is compiled for Java 25; an older JRE fails with UnsupportedClassVersionError.
FROM eclipse-temurin:25-jre

ARG OTP_VERSION=2.10.0
ARG OTP_SHA1=cc2f88081d468372fb3c4e7ca37a5f8f6cd8233c

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/otp
RUN curl -sSL --retry 3 -o otp.jar \
      "https://repo1.maven.org/maven2/org/opentripplanner/otp-shaded/${OTP_VERSION}/otp-shaded-${OTP_VERSION}.jar" \
 && echo "${OTP_SHA1}  otp.jar" | sha1sum -c -

# The router and feature configuration ship with the image so a code change to them takes
# effect on the next deploy. build-config.json is included for the record; it is only read
# when building a graph, which this image never does.
COPY build-config.json router-config.json otp-config.json /opt/otp/config/
COPY entrypoint.sh /opt/otp/entrypoint.sh
RUN chmod +x /opt/otp/entrypoint.sh

# Where graph.obj lives. Mount a persistent disk here.
VOLUME /var/otp
ENV OTP_DIR=/var/otp \
    OTP_XMX=2500m \
    PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -sf "http://localhost:${PORT}/otp/actuators/health" || exit 1

ENTRYPOINT ["/opt/otp/entrypoint.sh"]
