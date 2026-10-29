# Cloudflare Containers run linux/amd64 images only.

# --- Build: Microsoft Build of OpenJDK 17 + Maven (same toolchain as CI) ---
FROM --platform=linux/amd64 mcr.microsoft.com/openjdk/jdk:17-ubuntu AS build

ARG MAVEN_VERSION=3.9.16
ARG MAVEN_SHA512=831a8591fe20c8243b1dbe7d71e3244f31d1665b0804b2e825e38cbbe5ce0cafb8338851f90780735568773e0a6cd07bbec107cda0b896b008b861075358b6f6

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl -fsSLo /tmp/maven.tar.gz "https://archive.apache.org/dist/maven/maven-3/${MAVEN_VERSION}/binaries/apache-maven-${MAVEN_VERSION}-bin.tar.gz" \
 && echo "${MAVEN_SHA512}  /tmp/maven.tar.gz" | sha512sum -c - \
 && tar -xzf /tmp/maven.tar.gz -C /opt \
 && rm /tmp/maven.tar.gz
ENV PATH="/opt/apache-maven-${MAVEN_VERSION}/bin:${PATH}"

WORKDIR /app
# Resolve dependencies in their own layer so source-only changes rebuild fast.
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
# The commit this image is built from, shown by the Deployed apps tile. Declared
# here so changing it only rebuilds the layers below.
ARG GIT_SHA=unknown
RUN mvn -B -q package -DskipTests -Dgit.sha="${GIT_SHA}" && cp target/*.jar app.jar

# --- Runtime: minimal Microsoft Build of OpenJDK 17 ---
FROM --platform=linux/amd64 mcr.microsoft.com/openjdk/jdk:17-distroless

COPY --from=build /app/app.jar /app/app.jar
USER 1000:1000
EXPOSE 8080
ENTRYPOINT ["/usr/jdk/bin/java", "-XX:MaxRAMPercentage=75", "-Djava.io.tmpdir=/tmp", "-jar", "/app/app.jar"]
