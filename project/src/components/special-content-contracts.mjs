export function withSpecialCopy(page){
 if(page.themeKey!=='theme17'||![1,2,3,4,5,16,46,59,68].includes(page.pageNumber))return page;
 return {...page,defaultProps:{...page.defaultProps,contentLead:'',contentEvidence:''},copyBudgets:{...page.copyBudgets,contentLead:{maxChars:80},contentEvidence:{maxChars:180}}};
}
