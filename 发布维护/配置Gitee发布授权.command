#!/bin/zsh
SCRIPT_DIR="${0:A:h}"
python3 "$SCRIPT_DIR/configure_gitee_auth.py"
printf '\n按回车关闭窗口。'
read -r
