FROM cafienne/service:latest
WORKDIR /opt/cafienne
USER root
COPY src/ /opt/cafienne/
COPY target/ /opt/cafienne
RUN chown -R daemon:daemon conf/ definitions/
USER daemon