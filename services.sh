#!/bin/bash

if [ -z "$1" ]; then
  echo "Please provide a command: start | stop | restart | status | reset"
  exit 1
fi

case "$1" in
  "start") docker-compose up -d ;;
  "stop") docker-compose down ;;
  "restart") docker-compose restart ;;
  "status") sudo docker ps | grep -E "(bringg_postgres|bringg_redis|bringg_rabbitmq)" ;;
  "reset")
    docker-compose down -v
    docker-compose up -d
    sleep 5
    npx knex migrate:latest
    ;;
  *) exit 1 ;;
esac