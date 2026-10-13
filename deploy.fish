#!/usr/bin/env fish

rm -rf build

npm run build

ssh root@n0fa.de "rm -rf /var/www/html/ripple"

rsync -av web/dist/ root@n0fa.de:/var/www/html/ripple/

ssh root@n0fa.de "./tmux-ripple.sh"
