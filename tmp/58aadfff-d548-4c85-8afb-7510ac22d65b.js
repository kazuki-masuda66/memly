
              const PDFExtract = require('pdf.js-extract').PDFExtract;
              const pdfExtract = new PDFExtract();
              
              pdfExtract.extract('tmp\\592fab21-b8ca-4a0b-9278-f7a4f9f0ada5.pdf', {})
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
            