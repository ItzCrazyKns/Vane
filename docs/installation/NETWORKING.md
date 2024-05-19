# Expose Perplexica to a network

This guide will show you how to make Perplexica available over a network. Follow these steps to allow computers on the same network to interact with Perplexica. Choose the instructions that match the operating system you are using.

## Windows

1. Open PowerShell as Administrator

2. Navigate to the directory containing the `docker-compose.yaml` file

3. Stop and remove the existing Perplexica containers and images:

```
docker compose down --rmi all
```

4. Open the `docker-compose.yaml` file in a text editor like Notepad++

5. Replace `127.0.0.1` with the IP address of the server Perplexica is running on in these two lines:

```
args:
  - NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
  - NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3001
```

6. Save and close the `docker-compose.yaml` file

7. Rebuild and restart the Perplexica container:

```
docker compose up -d --build
```

## macOS

1. Open the Terminal application

2. Navigate to the directory with the `docker-compose.yaml` file:

```
cd /path/to/docker-compose.yaml
```

3. Stop and remove existing containers and images:

```
docker compose down --rmi all
```

4. Open `docker-compose.yaml` in a text editor like Sublime Text:

```
nano docker-compose.yaml
```

5. Replace `127.0.0.1` with the server IP in these lines:

```
args:
  - NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
  - NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3001
```

6. Save and exit the editor

7. Rebuild and restart Perplexica:

```
docker compose up -d --build
```

## Linux

1. Open the terminal

2. Navigate to the `docker-compose.yaml` directory:

```
cd /path/to/docker-compose.yaml
```

3. Stop and remove containers and images:

```
docker compose down --rmi all
```

4. Edit `docker-compose.yaml`:

```
nano docker-compose.yaml
```

5. Replace `127.0.0.1` with the server IP:

```
args:
  - NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api
  - NEXT_PUBLIC_WS_URL=ws://127.0.0.1:3001
```

6. Save and exit the editor

7. Rebuild and restart Perplexica:

```
docker compose up -d --build
```
