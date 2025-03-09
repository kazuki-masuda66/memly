
              const PDFExtract = require('pdf.js-extract').PDFExtract;
              const pdfExtract = new PDFExtract();
              
              pdfExtract.extract('tmp\\255f1da0-2e73-4192-9a5d-007183542641.pdf', {})
                .then(data => {
                  // ページごとのテキストを連結
                  let allText = '';
                  if (data && data.pages) {
                    data.pages.forEach(page => {
                      if (page.content) {
                        page.content.forEach(item => {
                          if (item.str) {
                            allText += item.str + ' ';
                          }
                        });
                        allText += '\n\n'; // ページの区切り
                      }
                    });
                  }
                  console.log(JSON.stringify({ text: allText }));
                })
                .catch(err => {
                  console.error(JSON.stringify({ error: err.message }));
                  process.exit(1);
                });
            