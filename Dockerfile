# syntax=docker/dockerfile:1
FROM nginx:alpine

# 静的サイト一式を配信
COPY site/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
