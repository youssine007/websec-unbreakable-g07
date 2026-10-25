FROM python:3.13-slim AS build
WORKDIR /src
COPY requirements.txt ./
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.13-slim
WORKDIR /app
# The base image's own preinstalled pip vendors old copies of setuptools,
# urllib3 and msgpack (pip/_vendor/*); the runtime image never calls pip,
# so drop it rather than carry known CVEs in code that's never executed.
RUN pip uninstall -y pip
COPY --from=build /install /usr/local
COPY app ./app
EXPOSE 8123
USER 1000:1000
ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8123"]
