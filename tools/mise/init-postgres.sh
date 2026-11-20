# Source this file so the container runtime inherits the variables.
export POSTGRES_DB="${DB_DATABASE:?}"
export POSTGRES_USER="${DB_USER:?}"
export POSTGRES_PASSWORD="${DB_PASSWORD:?}"
