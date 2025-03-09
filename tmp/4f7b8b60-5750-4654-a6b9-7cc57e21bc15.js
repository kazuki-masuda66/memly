
              const fs = require('fs');
              const pdfParse = require('pdf-parse');
              
              const dataBuffer = fs.readFileSync('tmp\\592fab21-b8ca-4a0b-9278-f7a4f9f0ada5.pdf');
              
              pdfParse(dataBuffer).then(data => {
                console.log(JSON.stringify({ text: data.text }));
              }).catch(err => {
                console.error(JSON.stringify({ error: err.message }));
                process.exit(1);
              });
            