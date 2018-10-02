set -v
sed -i.bak s/Hello/Hi/g index.js
sed -i.bak s/Hello/Hi/g test/*.js
set +v

# Clean up clutter
rm *.bak
rm test/*.bak