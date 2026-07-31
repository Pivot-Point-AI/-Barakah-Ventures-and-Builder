const fs = require('fs');
const path = require('path');

function build(name, files) {
  const parts = files.map((f) => fs.readFileSync(path.join(__dirname, 'src', name, f), 'utf8'));
  fs.writeFileSync(path.join(__dirname, `${name}.html`), parts.join(''), 'utf8');
  console.log(`Built ${name}.html from ${files.length} section files`);
}

build('index', [
  '00-head.html',
  '01-hero.html',
  '02-features.html',
  '03-painpoints.html',
  '04-livebetter.html',
  '05-process.html',
  '06-testimonials.html',
  '07-panels.html',
  '08-howwebuild.html',
  '09-footer.html',
]);

build('contact', [
  '00-head.html',
  '01-hero.html',
  '02-form.html',
  '03-footer.html',
]);
