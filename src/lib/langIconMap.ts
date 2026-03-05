// langIconMap.ts

import React from 'react';

export type DeviconComponent = React.ComponentType<{
  size?: string | number;   
  className?: string;
}>;

type LazyIcon = () => Promise<{ default: DeviconComponent }>;

export const langIconMap: Record<string, LazyIcon> = {
  // Web
  javascript:  () => import('@devicon/react/javascript/original'),
  js:          () => import('@devicon/react/javascript/original'),
  typescript:  () => import('@devicon/react/typescript/original'),
  ts:          () => import('@devicon/react/typescript/original'),
  jsx:         () => import('@devicon/react/react/original'),
  tsx:         () => import('@devicon/react/react/original'),
  html:        () => import('@devicon/react/html5/original'),
  css:         () => import('@devicon/react/css3/original'),
  sass:        () => import('@devicon/react/sass/original'),
  scss:        () => import('@devicon/react/sass/original'),
  svelte:      () => import('@devicon/react/svelte/original'),
  vue:         () => import('@devicon/react/vuejs/original'),
  angular:     () => import('@devicon/react/angularjs/original'),

  // Backend
  python:      () => import('@devicon/react/python/original'),
  py:          () => import('@devicon/react/python/original'),
  java:        () => import('@devicon/react/java/original'),
  kotlin:      () => import('@devicon/react/kotlin/original'),
  swift:       () => import('@devicon/react/swift/original'),
  go:          () => import('@devicon/react/go/original'),
  golang:      () => import('@devicon/react/go/original'),
  rust:        () => import('@devicon/react/rust/original'),
  ruby:        () => import('@devicon/react/ruby/original'),
  rb:          () => import('@devicon/react/ruby/original'),
  php:         () => import('@devicon/react/php/original'),
  scala:       () => import('@devicon/react/scala/original'),
  elixir:      () => import('@devicon/react/elixir/original'),
  haskell:     () => import('@devicon/react/haskell/original'),
  lua:         () => import('@devicon/react/lua/original'),
  perl:        () => import('@devicon/react/perl/original'),
  r:           () => import('@devicon/react/r/original'),
  dart:        () => import('@devicon/react/dart/original'),
  groovy:      () => import('@devicon/react/groovy/original'),
  clojure:     () => import('@devicon/react/clojure/original'),
  fsharp:      () => import('@devicon/react/fsharp/original'),

  // C family
  c:           () => import('@devicon/react/c/original'),
  cpp:         () => import('@devicon/react/cplusplus/original'),
  'c++':       () => import('@devicon/react/cplusplus/original'),
  csharp:      () => import('@devicon/react/csharp/original'),
  'c#':        () => import('@devicon/react/csharp/original'),

  // Shell
  bash:        () => import('@devicon/react/bash/original'),
  shell:       () => import('@devicon/react/bash/original'),
  sh:          () => import('@devicon/react/bash/original'),
  powershell:  () => import('@devicon/react/powershell/original'),
  ps1:         () => import('@devicon/react/powershell/original'),

  // Data / Config
  json:        () => import('@devicon/react/json/plain'),
  yaml:        () => import('@devicon/react/yaml/original'),
  yml:         () => import('@devicon/react/yaml/original'),
  xml:         () => import('@devicon/react/xml/plain'),
  graphql:     () => import('@devicon/react/graphql/plain'),

  // Database
  sql:         () => import('@devicon/react/mysql/original'),
  mysql:       () => import('@devicon/react/mysql/original'),
  postgresql:  () => import('@devicon/react/postgresql/original'),
  postgres:    () => import('@devicon/react/postgresql/original'),
  mongodb:     () => import('@devicon/react/mongodb/original'),
  redis:       () => import('@devicon/react/redis/original'),
  sqlite:      () => import('@devicon/react/sqlite/original'),

  // DevOps
  docker:      () => import('@devicon/react/docker/original'),
  dockerfile:  () => import('@devicon/react/docker/original'),
  kubernetes:  () => import('@devicon/react/kubernetes/plain'),
  nginx:       () => import('@devicon/react/nginx/original'),
  terraform:   () => import('@devicon/react/terraform/original'),

  // Mobile
  flutter:     () => import('@devicon/react/flutter/original'),

  // Docs
  markdown:    () => import('@devicon/react/markdown/original'),
  md:          () => import('@devicon/react/markdown/original'),
};
