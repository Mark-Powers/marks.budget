function remove(id){
    if (confirm(`Delete transaction?`)) {
        let request = new Request(`/ledger/${id}`, {
            method: 'delete',
        })
        fetch(request).then(r => window.location = "/ledger");
    }
}